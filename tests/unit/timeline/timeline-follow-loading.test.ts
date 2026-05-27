import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeWebSocket,
  findFollowsReq,
  followsSubId,
  pubkey,
  runtimeFor,
  sockets,
} from './timeline-follow-helpers';

describe('timeline follow loading', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('requests the latest follow list without a since bound', async () => {
    const active = pubkey();
    const runtime = runtimeFor({ activeAccountPubkey: active });
    await runtime.start();
    await vi.waitFor(() => {
      sockets.forEach((s) => s.open());
      const req = findFollowsReq(active);
      expect(req).toBeTruthy();
    });

    const req = findFollowsReq(active) as unknown[];
    expect(req).toEqual([
      'REQ',
      expect.any(String),
      {
        kinds: [3],
        authors: [active],
        limit: 1,
      },
    ]);
  });

  it('waits for every relay before falling back from missing follows', async () => {
    const active = pubkey();
    const states: string[] = [];
    const runtime = runtimeFor({
      activeAccountPubkey: active,
      relays: ['relay-one.example', 'relay-two.example'],
    });
    runtime.subscribe((state) => states.push(state.status));
    await runtime.start();
    let followSockets: FakeWebSocket[] = [];

    await vi.waitFor(() => {
      sockets.forEach((socket) => socket.open());
      followSockets = sockets.filter((socket) =>
        Boolean(followsSubId(socket, active)),
      );
      return followSockets.length >= 2;
    });

    const followSubs = followSockets.map(
      (socket) => followsSubId(socket, active)!,
    );
    followSockets[0]?.receive(JSON.stringify(['EOSE', followSubs[0]]));
    followSockets[0]?.close();
    expect(states).not.toContain('no-follow-list');
    for (let i = 1; i < followSockets.length; i += 1)
      followSockets[i]?.receive(JSON.stringify(['EOSE', followSubs[i]]));
    for (let i = 1; i < followSockets.length; i += 1) followSockets[i]?.close();
    await vi.waitFor(() => expect(states).toContain('no-follow-list'), {
      timeout: 15_000,
    });
  });

  it('does not start self-only notes after missing follows', async () => {
    const active = pubkey();
    let status = '';
    const runtime = runtimeFor({
      activeAccountPubkey: active,
      relays: ['relay-one.example', 'relay-two.example'],
    });
    runtime.subscribe((state) => {
      status = state.status;
    });
    await runtime.start();
    let followSockets: FakeWebSocket[] = [];
    await vi.waitFor(() => {
      sockets.forEach((socket) => socket.open());
      followSockets = sockets.filter((socket) =>
        Boolean(followsSubId(socket, active)),
      );
      return followSockets.length >= 2;
    });

    const followSubs = followSockets.map(
      (socket) => followsSubId(socket, active)!,
    );
    for (let i = 0; i < followSockets.length; i += 1)
      followSockets[i]?.receive(JSON.stringify(['EOSE', followSubs[i]]));
    for (let i = 0; i < followSockets.length; i += 1) followSockets[i]?.close();
    await vi.waitFor(() => expect(status).toBe('no-follow-list'), {
      timeout: 15_000,
    });
    expect(runtime.items()).toHaveLength(0);
    const noteFilters = sockets
      .flatMap((socket) => socket.sent)
      .map((raw) => JSON.parse(raw) as unknown[])
      .filter((message) => message[0] === 'REQ')
      .flatMap(
        (message) =>
          message.slice(2) as Array<{ authors?: string[]; kinds?: number[] }>,
      );
    expect(
      noteFilters.some(
        (filter) =>
          filter.kinds?.includes(1) &&
          filter.authors?.length === 1 &&
          filter.authors[0] === active,
      ),
    ).toBe(false);
  });
});
