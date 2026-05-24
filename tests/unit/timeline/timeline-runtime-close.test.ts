import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from 'nostr-tools/pure';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRelayPool } from '../../../src/lib/relays/relay-pool';
import { createTimelineRuntime } from '../../../src/lib/timeline/timeline-runtime';
import { storeTimelineEvent } from '../../../src/lib/timeline/timeline-store';
import { FakeWebSocket, sockets } from './fake-websocket';

describe('timeline runtime close guards', () => {
  beforeEach(() => {
    sockets.length = 0;
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ignores live events after close', async () => {
    const activeKey = generateSecretKey();
    const followedKey = generateSecretKey();
    const active = getPublicKey(activeKey);
    const followed = getPublicKey(followedKey);
    await storeTimelineEvent(
      finalizeEvent(
        { created_at: 120, kind: 3, tags: [['p', followed]], content: '' },
        activeKey,
      ),
    );
    const seen: string[] = [];
    const runtime = createTimelineRuntime({
      relays: ['relay.example'],
      subId: 'timeline-test',
      activeAccountPubkey: active,
      pool: createRelayPool(),
    });
    runtime.subscribe((state) =>
      seen.push(...state.items.map((item) => item.event.content)),
    );
    await runtime.start();
    sockets[0]?.open();
    runtime.close();
    const note = finalizeEvent(
      { created_at: 121, kind: 1, tags: [], content: 'late note' },
      followedKey,
    );
    sockets[0]?.receive(JSON.stringify(['EVENT', 'timeline-test:notes', note]));
    expect(seen).not.toContain('late note');
  });
});
