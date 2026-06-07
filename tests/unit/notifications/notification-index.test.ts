import { describe, expect, it } from 'vitest';
import { deriveNotifications } from '../../../src/lib/notifications/notification-index';
import {
  notificationActionLabel,
  notificationActionText,
  notificationContext,
  notificationContextEventId,
} from '../../../src/lib/notifications/notification-presentation';
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
    expect(Object.keys(records[0])).not.toContain('read' + 'At');
  });

  it('maps notification records to expected action labels', () => {
    expect(notificationActionLabel('mention')).toBe('mentioned you');
    expect(notificationActionLabel('reply')).toBe('replied to you');
    expect(notificationActionLabel('reaction')).toBe('reacted to you');
    expect(notificationActionLabel('repost')).toBe('reposted you');
    expect(notificationActionLabel('quote')).toBe('quoted you');
    expect(notificationActionLabel('profile-reference')).toBe(
      'referenced your profile',
    );
  });

  it('formats reaction notification text from the source event', () => {
    const record = deriveNotifications(accountPubkey, {
      ...event,
      kind: 7,
      content: '+',
    })[0];
    expect(
      notificationActionText(record, { ...event, kind: 7, content: '+' }),
    ).toBe('reacted with ❤️');
    expect(
      notificationActionText(record, { ...event, kind: 7, content: '' }),
    ).toBe('reacted with ❤️');
    expect(
      notificationActionText(record, { ...event, kind: 7, content: '☆' }),
    ).toBe('reacted with ☆');
  });

  it('does not create follow notifications from kind 3 follow lists', () => {
    expect(
      deriveNotifications(accountPubkey, {
        ...event,
        kind: 3,
        tags: [['p', accountPubkey]],
      }),
    ).toEqual([]);
  });

  it('derives zap and generic repost notifications', () => {
    expect(
      deriveNotifications(accountPubkey, {
        ...event,
        kind: 9735,
        tags: [['p', accountPubkey]],
      })[0]?.kind,
    ).toBe('zap');
    expect(
      deriveNotifications(accountPubkey, {
        ...event,
        kind: 16,
        tags: [['p', accountPubkey]],
      })[0]?.kind,
    ).toBe('repost');
  });

  it('does not expose an empty notification context thread id', () => {
    const record = {
      ...deriveNotifications(accountPubkey, event)[0],
      targetEventId: '',
      rootEventId: '',
    };
    expect(notificationContext(record)).toBe('context unavailable');
    expect(notificationContextEventId(record)).toBeNull();
  });
});
