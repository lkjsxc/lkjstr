import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCachePinsForTests,
  clearOpenReferencePins,
  clearVisibleEventPins,
  pinOpenReferences,
  pinVisibleEvents,
  pinnedEventIds,
} from '../../../src/lib/cache/pins';
import { notificationOpenReferenceIds } from '../../../src/lib/notifications/notification-view-rows';
import type { NotificationRecord } from '../../../src/lib/notifications/notification';

describe('cache pins', () => {
  beforeEach(() => clearCachePinsForTests());

  it('unions owner-scoped visible and open-reference pins', () => {
    pinVisibleEvents('tab-a', ['a', 'b']);
    pinVisibleEvents('tab-b', ['b', 'c']);
    pinOpenReferences('thread-a', ['d']);
    expect([...pinnedEventIds()].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('clears one owner without replacing other tab pins', () => {
    pinVisibleEvents('tab-a', ['a']);
    pinVisibleEvents('tab-b', ['b']);
    pinOpenReferences('thread-a', ['c']);
    clearVisibleEventPins('tab-a');
    clearOpenReferencePins('thread-a');
    expect([...pinnedEventIds()]).toEqual(['b']);
  });

  it('replaces owner-scoped runtime pins without keeping empty ids', () => {
    pinVisibleEvents('tab-a', ['a', '']);
    pinVisibleEvents('tab-a', ['b']);
    expect([...pinnedEventIds()]).toEqual(['b']);
  });

  it('pins visible notification source, target, and root references by owner', () => {
    pinOpenReferences('notifications:tab-a', [
      ...notificationOpenReferenceIds([
        notification('source-a', 'target-a', 'root-a'),
        notification('source-b', undefined, 'root-a'),
      ]),
    ]);
    expect([...pinnedEventIds()].sort()).toEqual([
      'root-a',
      'source-a',
      'source-b',
      'target-a',
    ]);
    clearOpenReferencePins('notifications:tab-a');
    expect([...pinnedEventIds()]).toEqual([]);
  });
});

function notification(
  sourceEventId: string,
  targetEventId?: string,
  rootEventId?: string,
): NotificationRecord {
  return {
    id: sourceEventId,
    accountPubkey: 'account',
    sourceEventId,
    actorPubkey: 'actor',
    kind: 'mention',
    createdAt: 1,
    receivedAt: 1,
    muted: false,
    hidden: false,
    rootEventId,
    targetEventId,
    relayUrls: [],
  };
}
