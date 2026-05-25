import { describe, expect, it } from 'vitest';
import { windowNotifications } from '../../../src/lib/notifications/notification-window';
import type { FeedEvent } from '../../../src/lib/events/types';
import type { NostrEvent } from '../../../src/lib/protocol';
import type { NotificationRecord } from '../../../src/lib/notifications/notification';

describe('notification windowing', () => {
  it('prunes by record count and keeps unavailable source rows', () => {
    const source = feed('1');
    const target = feed('2');
    const window = windowNotifications({
      records: [
        record('old', '9'.repeat(64)),
        record('new', source.event.id, target.event.id),
      ],
      items: [source],
      targetItems: [target, feed('3')],
      limit: 1,
    });

    expect(window.pruned).toBe(true);
    expect(window.records.map((item) => item.id)).toEqual(['new']);
    expect(window.items.map((item) => item.event.id)).toEqual([
      source.event.id,
    ]);
    expect(window.targetItems.map((item) => item.event.id)).toEqual([
      target.event.id,
    ]);
  });
});

function record(
  id: string,
  sourceEventId: string,
  targetEventId?: string,
): NotificationRecord {
  return {
    id,
    accountPubkey: 'a'.repeat(64),
    sourceEventId,
    actorPubkey: 'b'.repeat(64),
    kind: 'mention',
    createdAt: id === 'old' ? 1 : 2,
    receivedAt: 1,
    readAt: null,
    muted: false,
    hidden: false,
    targetEventId,
    relayUrls: [],
  };
}

function feed(seed: string): FeedEvent {
  const event: NostrEvent = {
    id: seed.repeat(64).slice(0, 64),
    pubkey: seed.repeat(64).slice(0, 64),
    created_at: Number.parseInt(seed, 16),
    kind: 1,
    tags: [],
    content: seed,
    sig: seed.repeat(128).slice(0, 128),
  };
  return { event, relays: [] };
}
