import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RelayPool } from '../../../src/lib/relays/relay-pool';
import { TimelineRuntime } from '../../../src/lib/timeline/timeline-runtime';
import { storeTimelineEvent } from '../../../src/lib/timeline/timeline-store';
import { FakeWebSocket, parsedSocketMessage, sockets } from './fake-websocket';

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
    await vi.waitFor(() =>
      expect(parsedSocketMessage('timeline-test:notes:initial')).toBeTruthy(),
    );
    const initialSub = String(
      (parsedSocketMessage('timeline-test:notes:initial') as unknown[])[1],
    );
    const oldNote = finalizeEvent(
      { created_at: 1, kind: 1, tags: [], content: 'old relay note' },
      followedKey,
    );
    socketForSub(initialSub)?.receive(
      JSON.stringify(['EVENT', initialSub, oldNote]),
    );
    socketForSub(initialSub)?.receive(JSON.stringify(['EOSE', initialSub]));
    await vi.waitFor(() => expect(states.at(-1)).toContain('old relay note'));
  });
});

function socketForSub(subId: string): FakeWebSocket | undefined {
  return sockets.find((socket) =>
    socket.sent.some((item) => String(JSON.parse(item)[1]) === subId),
  );
}
