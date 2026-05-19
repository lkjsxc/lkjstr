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
    const initialSub = subIdStarting('timeline-test:notes:initial');
    const oldNote = finalizeEvent(
      { created_at: 1, kind: 1, tags: [], content: 'old relay note' },
      followedKey,
    );
    sockets[0]?.receive(JSON.stringify(['EVENT', initialSub, oldNote]));
    sockets[0]?.receive(JSON.stringify(['EOSE', initialSub]));
    await vi.waitFor(() => expect(states.at(-1)).toContain('old relay note'));
  });
});

function subIdStarting(prefix: string): string {
  const sent = sockets.flatMap((socket) => socket.sent);
  const raw = sent.find((item) =>
    String(JSON.parse(item)[1]).startsWith(prefix),
  );
  return String((JSON.parse(raw ?? '[]') as unknown[])[1]);
}
