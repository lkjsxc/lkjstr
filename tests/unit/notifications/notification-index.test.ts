import { describe, expect, it } from 'vitest';
import {
  deriveNotifications,
  markRead,
  unreadCount,
} from '../../../src/lib/notifications/notification-index';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('notification index', () => {
  const accountPubkey = 'a'.repeat(64);
  const event: NostrEvent = {
    id: 'b'.repeat(64),
    pubkey: 'c'.repeat(64),
    created_at: 10,
    kind: 1,
    tags: [
      ['p', accountPubkey],
      ['e', 'd'.repeat(64), '', 'root'],
    ],
    content: 'hello',
    sig: 'e'.repeat(128),
  };

  it('derives account-scoped records without scanning at render time', () => {
    const records = deriveNotifications(accountPubkey, event, ['wss://relay/']);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: 'reply',
      actorPubkey: event.pubkey,
    });
    expect(unreadCount(records)).toBe(1);
    expect(unreadCount(markRead(records))).toBe(0);
  });
});
