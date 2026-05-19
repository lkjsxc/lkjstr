import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { TimelineRuntime } from '../../../src/lib/timeline/timeline-runtime';
import { storeTimelineEvent } from '../../../src/lib/timeline/timeline-store';

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  readonly sent: string[] = [];
  constructor(readonly url: string) {
    sockets.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.onclose?.({} as CloseEvent);
  }
  open(): void {
    this.onopen?.({} as Event);
  }
  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

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
    sockets[0]?.open();
    // prettier-ignore
    expect(JSON.parse(sockets[0]?.sent[0] ?? '[]')).toEqual(['REQ', 'timeline-test:notes', expect.objectContaining({ kinds: [1], authors: [active, followed], limit: 30, since: expect.any(Number) })]);
  });

  it('falls back to self notes when no follow list is found', async () => {
    const active = pubkey();
    const states: string[] = [];
    const runtime = runtimeFor({ activeAccountPubkey: active });
    runtime.subscribe((state) => states.push(state.status));
    await runtime.start();
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['EOSE', 'timeline-test:follows']));
    await vi.waitFor(() => expect(states).toContain('no-follow-list'));
    // prettier-ignore
    expect(JSON.parse(sockets[0]?.sent[1] ?? '[]')).toEqual(['REQ', 'timeline-test:notes', expect.objectContaining({ kinds: [1], authors: [active], limit: 30, since: expect.any(Number) })]);
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
    sockets[0]?.open();
    sockets[0]?.receive(JSON.stringify(['EOSE', 'timeline-test:notes']));
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
    sockets[0]?.open();
    const note = finalizeEvent(
      { created_at: 103, kind: 1, tags: [], content: 'followed note' },
      followedKey,
    );
    sockets[0]?.receive(JSON.stringify(['EVENT', 'timeline-test:notes', note]));
    await vi.waitFor(() => expect(states.at(-1)).toContain('followed note'));
    runtime.close();
    expect(sockets[0]?.sent).toContain('["CLOSE","timeline-test:notes"]');
    expect(sockets[0]?.sent).toContain('["CLOSE","timeline-test:meta"]');
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
    sockets[0]?.open();
    const metadata = finalizeEvent(
      {
        created_at: 105,
        kind: 0,
        tags: [],
        content: JSON.stringify({ display_name: 'Followed Writer' }),
      },
      followedKey,
    );
    sockets[0]?.receive(
      JSON.stringify(['EVENT', 'timeline-test:meta', metadata]),
    );
    await vi.waitFor(() => expect(displayName).toBe('Followed Writer'));
  });
});

function runtimeFor(options: {
  activeAccountPubkey?: string | null;
  relays?: readonly string[];
}): TimelineRuntime {
  return new TimelineRuntime({
    relays: options.relays ?? ['relay.example'],
    subId: 'timeline-test',
    activeAccountPubkey: options.activeAccountPubkey,
    pool: new RelayPool(),
  });
}

function pubkey(): string {
  return getPublicKey(generateSecretKey());
}
