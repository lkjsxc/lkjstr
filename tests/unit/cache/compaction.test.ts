import { describe, expect, it } from 'vitest';
import {
  eventPriorityRecord,
  kindWeight,
  priorityTargetBumps,
  scoreEvent,
} from '../../../src/lib/cache/event-priority';
import { shouldCompact } from '../../../src/lib/cache/cache-budget-enforcement';
import {
  compactOldEvents,
  latestEventIdsByPubkey,
  selectPruneIds,
} from '../../../src/lib/cache/compaction';
import {
  cacheCompactionWriteThreshold,
  shouldScheduleCompaction,
} from '../../../src/lib/cache/compaction-scheduler';
import {
  clearCachePinsForTests,
  pinVisibleEvents,
  pinnedEventIds,
} from '../../../src/lib/cache/pins';

describe('cache compaction', () => {
  it('scores structural relationships above baseline time', () => {
    const score = scoreEvent({
      id: 'a',
      pubkey: 'p',
      created_at: 100,
      kind: 1,
      tags: [['e', 'parent', '', 'reply']],
      content: '',
      sig: 'sig',
    });
    expect(score).toBeGreaterThan(scoreEvent(baseEvent(100)));
  });

  it('orders kind weights by retention value', () => {
    expect(kindWeight(0)).toBeGreaterThan(kindWeight(1));
    expect(kindWeight(3)).toBe(kindWeight(0));
    expect(kindWeight(1)).toBeGreaterThan(kindWeight(6));
    expect(kindWeight(6)).toBeGreaterThan(kindWeight(7));
    expect(kindWeight(7)).toBeGreaterThan(kindWeight(42));
  });

  it('assigns max target bumps for direct event and quote references', () => {
    const bumps = priorityTargetBumps({
      ...baseEvent(100),
      kind: 9735,
      tags: [
        ['e', 'event-target'],
        ['e', 'event-target'],
        ['q', 'quote-target'],
        ['p', 'pubkey-target'],
      ],
    });
    expect(bumps.get('event-target')).toBe(700);
    expect(bumps.get('quote-target')).toBe(700);
    expect(bumps.has('pubkey-target')).toBe(false);
    expect(
      priorityTargetBumps({
        ...baseEvent(100),
        kind: 7,
        tags: [['e', 'x']],
      }).get('x'),
    ).toBe(300);
    expect(
      priorityTargetBumps({
        ...baseEvent(100),
        kind: 6,
        tags: [['q', 'x']],
      }).get('x'),
    ).toBe(500);
  });

  it('selects the lowest unprotected priority rows for pruning', () => {
    const protectedIds = new Set(['runtime-pin']);
    expect(
      selectPruneIds(
        [
          priorityRecord('newer', 40, false),
          priorityRecord('runtime-pin', 5, false),
          priorityRecord('persisted-protected', 1, true),
          priorityRecord('lowest', 10, false),
          priorityRecord('middle', 20, false),
        ],
        protectedIds,
        2,
      ),
    ).toEqual(['lowest', 'middle']);
  });

  it('protects latest kind 0 per pubkey and active-account kind 3', () => {
    const events = [
      candidate('old-profile', 'alice', 0, 10),
      candidate('new-profile', 'alice', 0, 20),
      candidate('bob-profile', 'bob', 0, 15),
      candidate('old-contact', 'active', 3, 10),
      candidate('new-contact', 'active', 3, 30),
      candidate('other-contact', 'other', 3, 40),
    ];
    expect([...latestEventIdsByPubkey(events, 0)].sort()).toEqual([
      'bob-profile',
      'new-profile',
    ]);
    expect([...latestEventIdsByPubkey(events, 3, new Set(['active']))]).toEqual(
      ['new-contact'],
    );
  });

  it('keeps runtime pins out of persisted priority protection', () => {
    clearCachePinsForTests();
    pinVisibleEvents('tab-a', ['runtime-pin']);
    expect([...pinnedEventIds()]).toEqual(['runtime-pin']);
    expect(eventPriorityRecord(baseEvent(100))).toMatchObject({
      id: 'b',
      protected: false,
      cacheBytes: 0,
    });
    expect(eventPriorityRecord({ ...baseEvent(100), kind: 0 })).toMatchObject({
      protected: false,
    });
  });

  it('no-ops when indexeddb is unavailable in tests', async () => {
    await expect(compactOldEvents()).resolves.toMatchObject({
      skipped: true,
      prunedEvents: 0,
    });
  });

  it('does not prune without quota pressure in tests', async () => {
    const result = await compactOldEvents();
    expect(result.prunedEvents).toBe(0);
    expect(result.reason === 'below-budget-threshold' || result.skipped).toBe(
      true,
    );
  });

  it('compacts from internal bytes without browser estimates', () => {
    expect(shouldCompact(65, 64, null)).toBe(true);
    expect(shouldCompact(63, 64, null)).toBe(false);
  });

  it('uses browser estimates as additional pressure', () => {
    expect(
      shouldCompact(10, 64, { usage: 65, quota: 1000, ratio: 0.065 }),
    ).toBe(true);
    expect(
      shouldCompact(10, 64, { usage: 10, quota: 100, ratio: 0.9 }),
    ).toBe(true);
  });

  it('schedules compaction after the write threshold', () => {
    expect(shouldScheduleCompaction(cacheCompactionWriteThreshold - 1)).toBe(
      false,
    );
    expect(shouldScheduleCompaction(cacheCompactionWriteThreshold)).toBe(true);
  });
});

function priorityRecord(id: string, score: number, protectedRow: boolean) {
  return {
    id,
    score,
    createdAt: 1,
    protected: protectedRow,
    cacheBytes: 1,
    updatedAt: 1,
  };
}

function candidate(
  id: string,
  pubkey: string,
  kind: number,
  created_at: number,
) {
  return { id, pubkey, kind, created_at };
}

function baseEvent(created_at: number) {
  return {
    id: 'b',
    pubkey: 'p',
    created_at,
    kind: 1,
    tags: [],
    content: '',
    sig: 'sig',
  };
}
