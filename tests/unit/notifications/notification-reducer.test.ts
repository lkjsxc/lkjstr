import { describe, expect, it } from 'vitest';
import type { NotificationRecord } from '../../../src/lib/notifications/notification';
import {
  createEmptyNotificationReducerState,
  mergeNotificationReducerState,
} from '../../../src/lib/notifications/notification-reducer';

function record(id: string, createdAt: number): NotificationRecord {
  return {
    id,
    accountPubkey: 'a'.repeat(64),
    sourceEventId: `source:${id}`,
    actorPubkey: 'b'.repeat(64),
    kind: 'mention',
    createdAt,
    receivedAt: createdAt,
    readAt: null,
    muted: false,
    hidden: false,
    relayUrls: [],
  };
}

describe('notification reducer', () => {
  it('dedupes by record id and overwrites with incoming record', () => {
    const state = createEmptyNotificationReducerState();
    const next = mergeNotificationReducerState(
      { ...state, records: [record('x', 10), record('y', 5)] },
      [record('x', 20)],
      2,
    );
    expect(next.records.map((r) => r.id)).toEqual(['x', 'y']);
    expect(next.prunedOlder).toBe(false);
    expect(next.prunedNewer).toBe(false);
  });

  it('sorts by createdAt desc then id asc for tie-breaks', () => {
    const next = mergeNotificationReducerState(
      createEmptyNotificationReducerState(),
      [record('b', 10), record('a', 10)],
      2,
    );
    expect(next.records.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('prunes older incoming records when window is full', () => {
    const next = mergeNotificationReducerState(
      createEmptyNotificationReducerState(),
      [record('older', 9)],
      1,
    );
    expect(next.records.map((r) => r.id)).toEqual(['older']);
    expect(next.prunedOlder).toBe(false);
    expect(next.prunedNewer).toBe(false);

    const next2 = mergeNotificationReducerState(
      {
        ...createEmptyNotificationReducerState(),
        records: [record('newer', 10)],
        prunedOlder: false,
        prunedNewer: false,
      },
      [record('older', 9)],
      1,
    );
    expect(next2.records.map((r) => r.id)).toEqual(['newer']);
    expect(next2.prunedOlder).toBe(true);
    expect(next2.prunedNewer).toBe(false);
  });

  it('prunes existing records when incoming contains newer events', () => {
    const next = mergeNotificationReducerState(
      {
        ...createEmptyNotificationReducerState(),
        records: [record('existing', 9)],
      },
      [record('incoming', 10)],
      1,
    );
    expect(next.records.map((r) => r.id)).toEqual(['incoming']);
    expect(next.prunedOlder).toBe(false);
    expect(next.prunedNewer).toBe(true);
  });
});
