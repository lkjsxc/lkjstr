import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { TimelineRuntime } from '../../../src/lib/timeline/timeline-runtime';
import { storeTimelineEvent } from '../../../src/lib/timeline/timeline-store';
import { FakeWebSocket, sockets } from './fake-websocket';

describe('timeline initial relay pages', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('loads historical followed-author notes from initial relay pages', async () => {
    const activeKey = generateSecretKey();
    const followedKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = getPublicKey(followedKey);
    await storeTimelineEvent(
      finalizeEvent(
        { created_at: 106, kind: 3, tags: [['p', followed]], content: '' },
        activeKey,
      ),
    );
    const states: string[][] = [];
    const runtime = new TimelineRuntime({
      relays: ['relay.example'],
      subId: 'timeline-test',
      activeAccountPubkey: active,
      pool: new RelayPool(),
    });
    runtime.subscribe((state) =>
      states.push(state.items.map((item) => item.event.content)),
    );
    await runtime.start();
    sockets[0]?.open();
    const handled = new Set<string>();
    const first = await nextInitialMessage(handled);
    const filter = first.message[2] as { since: number };
    const oldNote = finalizeEvent(
      {
        created_at: filter.since + 1,
        kind: 1,
        tags: [],
        content: 'old relay note',
      },
      followedKey,
    );
    first.socket.receive(JSON.stringify(['EVENT', first.subId, oldNote]));
    first.socket.receive(JSON.stringify(['EOSE', first.subId]));
    for (let index = 0; index < 8; index += 1) {
      await vi.waitFor(() =>
        expect(
          states.at(-1)?.includes('old relay note') ||
            hasUnhandledInitialMessage(handled),
        ).toBe(true),
      );
      if (states.at(-1)?.includes('old relay note')) break;
      const next = findInitialMessage(handled);
      if (!next) break;
      next.socket.receive(JSON.stringify(['EOSE', next.subId]));
    }
    await vi.waitFor(() => expect(states.at(-1)).toContain('old relay note'));
  });
});

async function nextInitialMessage(handled: Set<string>): Promise<{
  readonly socket: FakeWebSocket;
  readonly message: unknown[];
  readonly subId: string;
}> {
  await vi.waitFor(() =>
    expect(hasUnhandledInitialMessage(handled)).toBe(true),
  );
  const hit = findInitialMessage(handled);
  if (hit) return hit;
  throw new Error('missing initial relay request');
}

function findInitialMessage(handled: Set<string>):
  | {
      readonly socket: FakeWebSocket;
      readonly message: unknown[];
      readonly subId: string;
    }
  | undefined {
  for (const socket of sockets)
    for (const item of socket.sent) {
      const message = JSON.parse(item) as unknown[];
      const subId = String(message[1]);
      const filter = message[2] as Record<string, unknown> | undefined;
      if (filter?.until && !handled.has(subId)) {
        handled.add(subId);
        return { socket, message, subId };
      }
    }
}

function hasUnhandledInitialMessage(handled: ReadonlySet<string>): boolean {
  return sockets.some((socket) =>
    socket.sent.some((item) => {
      const parsed = JSON.parse(item) as unknown[];
      const subId = String(parsed[1]);
      const filter = parsed[2] as Record<string, unknown> | undefined;
      return Boolean(filter?.until) && !handled.has(subId);
    }),
  );
}
