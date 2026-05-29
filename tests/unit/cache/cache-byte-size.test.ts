import { describe, expect, it } from 'vitest';
import {
  cacheByteSizeForEvent,
  encodedJsonBytes,
} from '../../../src/lib/cache/cache-byte-size';
import { eventPriorityRecord } from '../../../src/lib/cache/event-priority';

describe('cache byte size', () => {
  it('counts event-owned cache rows deterministically', () => {
    const stored = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      created_at: 10,
      kind: 1,
      tags: [['e', 'c'.repeat(64)]],
      content: 'hello',
      sig: 'd'.repeat(128),
      receivedAt: 11,
      relayUrls: ['wss://relay.example'],
    };
    const receipts = [
      {
        id: `${stored.id}:wss://relay.example`,
        eventId: stored.id,
        relayUrl: 'wss://relay.example',
        receivedAt: 11,
      },
    ];
    const tags = [
      {
        id: `${stored.id}:e:${'c'.repeat(64)}:0`,
        eventId: stored.id,
        tagName: 'e' as const,
        tagValue: 'c'.repeat(64),
        created_at: 10,
      },
    ];
    const priority = eventPriorityRecord(stored, tags, false, 0, 12);
    const expected =
      encodedJsonBytes(stored) +
      encodedJsonBytes(receipts[0]) +
      encodedJsonBytes(tags[0]) +
      encodedJsonBytes({ ...priority, cacheBytes: 0 });

    expect(cacheByteSizeForEvent(stored, receipts, tags, priority)).toBe(
      expected,
    );
    expect(expected).toBeGreaterThan(stored.content.length);
  });
});
