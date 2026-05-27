import { generateSecretKey, getPublicKey } from '../../../src/lib/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { createRelaySubscriptionManager } from '../../../src/lib/relays/subscription-manager';
import { managerAsOrchestrator } from '../../../src/lib/relays/orchestration/orchestrator';
import {
  createTimelineRuntime,
  type TimelineRuntime,
} from '../../../src/lib/timeline/timeline-runtime';

const sockets: FakeWebSocket[] = [];

class FakeWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
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
    expect(req).toEqual(['REQ', expect.any(String), {
      kinds: [3],
      authors: [active],
      limit: 1,
    }]);
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
      followSockets = sockets.filter((socket) => Boolean(followsSubId(socket, active)));
      return followSockets.length >= 2;
    });

    const followSubs = followSockets.map((socket) => followsSubId(socket, active)!);
    followSockets[0]?.receive(JSON.stringify(['EOSE', followSubs[0]]));
    followSockets[0]?.close();
    expect(states).not.toContain('no-follow-list');
    for (let i = 1; i < followSockets.length; i += 1)
      followSockets[i]?.receive(JSON.stringify(['EOSE', followSubs[i]]));
    for (let i = 1; i < followSockets.length; i += 1)
      followSockets[i]?.close();
    await vi.waitFor(
      () => expect(states).toContain('no-follow-list'),
      { timeout: 15_000 },
    );
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
      followSockets = sockets.filter((socket) => Boolean(followsSubId(socket, active)));
      return followSockets.length >= 2;
    });

    const followSubs = followSockets.map((socket) => followsSubId(socket, active)!);
    for (let i = 0; i < followSockets.length; i += 1)
      followSockets[i]?.receive(JSON.stringify(['EOSE', followSubs[i]]));
    for (let i = 0; i < followSockets.length; i += 1)
      followSockets[i]?.close();
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

function runtimeFor(options: {
  activeAccountPubkey: string;
  relays?: readonly string[];
}): TimelineRuntime {
  const pool = createRelayPool();
  return createTimelineRuntime({
    relays: options.relays ?? ['relay.example'],
    subId: 'timeline-test',
    owner: 'timeline-test',
    activeAccountPubkey: options.activeAccountPubkey,
    pool,
    subscriptions: managerAsOrchestrator(createRelaySubscriptionManager(pool), {
      keyPrefix: 'timeline-test',
    }),
  });
}

function pubkey(): string {
  return getPublicKey(generateSecretKey());
}

function subId(socket: FakeWebSocket | undefined): string {
  return String((JSON.parse(socket?.sent[0] ?? '[]') as unknown[])[1] ?? '');
}

function findFollowsReq(active: string): unknown[] | undefined {
  for (const socket of sockets) {
    for (const raw of socket.sent) {
      const msg = JSON.parse(raw) as unknown[];
      if (msg[0] !== 'REQ') continue;
      const filter = msg[2] as { kinds?: number[]; authors?: string[]; limit?: number };
      if (!filter?.kinds?.includes(3)) continue;
      if (filter.limit !== 1) continue;
      if (!filter.authors?.includes(active)) continue;
      return msg;
    }
  }
  return undefined;
}

function followsSubId(socket: FakeWebSocket, active: string): string | undefined {
  for (const raw of socket.sent) {
    const msg = JSON.parse(raw) as unknown[];
    if (msg[0] !== 'REQ') continue;
    const filter = msg[2] as { kinds?: number[]; authors?: string[]; limit?: number };
    if (!filter?.kinds?.includes(3)) continue;
    if (filter.limit !== 1) continue;
    if (!filter.authors?.includes(active)) continue;
    return String(msg[1]);
  }
  return undefined;
}
