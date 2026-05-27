// prettier-ignore
import { finalizeEvent, generateSecretKey, getPublicKey } from '../../../src/lib/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runtimeFor } from './timeline-runtime-helpers';
import {
  expectNoteReq,
  openAllSockets,
  parsedSent,
  waitForSub,
} from './timeline-runtime-test-helpers';
import { storeTimelineEvent } from '../../../src/lib/timeline/timeline-store';
import { FakeWebSocket, socketForSub, sockets } from './fake-websocket';

describe('timeline runtime', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads cache only and opens no sockets without an active account', async () => {
    const states: string[] = [];
    const runtime = runtimeFor({ activeAccountPubkey: null });
    runtime.subscribe((state) => states.push(state.status));
    await runtime.start();
    expect(states.at(-1)).toBe('no-active-account');
    expect(sockets).toHaveLength(0);
  });

  it('reports no enabled relay for an active account without fallback', async () => {
    const active = pubkey();
    const states: string[] = [];
    const runtime = runtimeFor({ activeAccountPubkey: active, relays: [] });
    runtime.subscribe((state) => states.push(state.status));
    await runtime.start();
    expect(states.at(-1)).toBe('no-enabled-relay');
    expect(sockets).toHaveLength(0);
  });

  it('uses cached follow lists to request self plus follows', async () => {
    const activeKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = pubkey();
    await storeTimelineEvent(
      finalizeEvent(
        { created_at: 100, kind: 3, tags: [['p', followed]], content: '' },
        activeKey,
      ),
    );
    const runtime = runtimeFor({ activeAccountPubkey: active });
    await runtime.start();
    openAllSockets();
    await waitForSub('timeline-test:notes', true);
    await vi.waitFor(
      () => expect(parsedSent('timeline-test:notes:initial')).toBeTruthy(),
      { timeout: 10_000 },
    );
    expectNoteReq('timeline-test:notes:initial', [active, followed], {
      withUntil: true,
    });
    expectNoteReq('timeline-test:notes', [active, followed], {
      exact: true,
    });
  });

  it('falls back to self notes when no follow list is found', async () => {
    const active = pubkey();
    const states: string[] = [];
    const runtime = runtimeFor({ activeAccountPubkey: active });
    runtime.subscribe((state) => states.push(state.status));
    await runtime.start();
    openAllSockets();
    socketForSub('timeline-test:follows')?.receive(
      JSON.stringify(['EOSE', 'timeline-test:follows']),
    );
    await vi.waitFor(() => expect(states).toContain('no-follow-list'));
    await waitForSub('timeline-test:notes', true);
    expectNoteReq('timeline-test:notes', [active], { exact: true });
  });

  it('stops loading on note eose without events', async () => {
    const activeKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    await storeTimelineEvent(
      finalizeEvent(
        { created_at: 101, kind: 3, tags: [], content: '' },
        activeKey,
      ),
    );
    let latest = '';
    const runtime = runtimeFor({ activeAccountPubkey: active });
    runtime.subscribe(
      (state) =>
        (latest = `${state.loading}:${state.status}:${state.eoseRelays}`),
    );
    await runtime.start();
    openAllSockets();
    await waitForSub('timeline-test:notes', true);
    socketForSub('timeline-test:notes')?.receive(
      JSON.stringify(['EOSE', 'timeline-test:notes']),
    );
    await vi.waitFor(() => expect(latest).toBe('false:ready-empty:1'));
  });

  it('stores followed-author events and closes on cleanup', async () => {
    const activeKey = generateSecretKey();
    const followedKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = getPublicKey(followedKey);
    await storeTimelineEvent(
      finalizeEvent(
        { created_at: 102, kind: 3, tags: [['p', followed]], content: '' },
        activeKey,
      ),
    );
    const states: string[][] = [];
    const runtime = runtimeFor({ activeAccountPubkey: active });
    runtime.subscribe((state) =>
      states.push(state.items.map((item) => item.event.content)),
    );
    await runtime.start();
    openAllSockets();
    // prettier-ignore
    const note = finalizeEvent({ created_at: Math.floor(Date.now() / 1000) + 1, kind: 1, tags: [], content: 'followed note' }, followedKey);
    await waitForSub('timeline-test:notes', true);
    socketForSub('timeline-test:notes')?.receive(
      JSON.stringify(['EVENT', 'timeline-test:notes', note]),
    );
    await vi.waitFor(() => expect(states.at(-1)).toContain('followed note'));
    runtime.close();
    const noteSub = (parsedSent('timeline-test:notes', true) as unknown[])[1];
    const metaSub = (parsedSent('timeline-test:meta', true) as unknown[])[1];
    expect(socketForSub('timeline-test:notes')?.sent).toContain(
      JSON.stringify(['CLOSE', noteSub]),
    );
    expect(socketForSub('timeline-test:meta')?.sent).toContain(
      JSON.stringify(['CLOSE', metaSub]),
    );
  });

  it('exposes profile display names from metadata', async () => {
    const activeKey = generateSecretKey();
    const followedKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = getPublicKey(followedKey);
    await storeTimelineEvent(
      finalizeEvent(
        { created_at: 104, kind: 3, tags: [['p', followed]], content: '' },
        activeKey,
      ),
    );
    let displayName: string | null | undefined;
    const runtime = runtimeFor({ activeAccountPubkey: active });
    runtime.subscribe(
      (state) => (displayName = state.profiles[followed]?.displayName),
    );
    await runtime.start();
    openAllSockets();
    const metadata = finalizeEvent(
      {
        created_at: 105,
        kind: 0,
        tags: [],
        content: JSON.stringify({ display_name: 'Followed Writer' }),
      },
      followedKey,
    );
    await waitForSub('timeline-test:meta', true);
    socketForSub('timeline-test:meta')?.receive(
      JSON.stringify(['EVENT', 'timeline-test:meta', metadata]),
    );
    await vi.waitFor(() => expect(displayName).toBe('Followed Writer'));
  });
});

function pubkey(): string {
  return getPublicKey(generateSecretKey());
}
