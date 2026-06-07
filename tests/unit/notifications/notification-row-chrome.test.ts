import { describe, expect, it } from 'vitest';
import type { NotificationRecord } from '../../../src/lib/notifications/notification';
import { notificationRowChrome } from '../../../src/lib/notifications/notification-row-chrome';

const base: NotificationRecord = {
  id: 'id',
  accountPubkey: 'a'.repeat(64),
  sourceEventId: 'b'.repeat(64),
  actorPubkey: 'c'.repeat(64),
  kind: 'reaction',
  createdAt: 1,
  receivedAt: 1,
  muted: false,
  hidden: false,
  relayUrls: [],
};

describe('notification row chrome', () => {
  it('hides redundant reaction chrome when source event is visible', () => {
    expect(
      notificationRowChrome({
        record: base,
        hasSourceItem: true,
        sourceShowsActor: true,
      }),
    ).toEqual({ kind: 'hidden' });
  });

  it('uses compact reaction fallback when source event is unavailable', () => {
    expect(
      notificationRowChrome({
        record: base,
        hasSourceItem: false,
        sourceShowsActor: false,
      }),
    ).toEqual({
      kind: 'compact-fallback',
      text: 'Reaction event unavailable.',
    });
  });

  it('keeps labels for non-reaction notifications', () => {
    expect(
      notificationRowChrome({
        record: { ...base, kind: 'mention' },
        hasSourceItem: true,
        sourceShowsActor: true,
      }),
    ).toMatchObject({ kind: 'normal', label: 'mentioned you' });
  });
});
