import { describe, expect, it } from 'vitest';
import {
  priorityTargetBumps,
  scoreEvent,
} from '../../../src/lib/cache/event-priority';
import { compactOldEvents } from '../../../src/lib/cache/compaction';
import {
  cacheCompactionWriteThreshold,
  shouldScheduleCompaction,
} from '../../../src/lib/cache/compaction-scheduler';

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

  it('assigns target bumps for direct event and quote references', () => {
    const bumps = priorityTargetBumps({
      ...baseEvent(100),
      kind: 6,
      tags: [
        ['e', 'event-target'],
        ['q', 'quote-target'],
      ],
    });
    expect(bumps.get('event-target')).toBeGreaterThan(0);
    expect(bumps.get('quote-target')).toBeGreaterThan(0);
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

  it('schedules compaction after the write threshold', () => {
    expect(shouldScheduleCompaction(cacheCompactionWriteThreshold - 1)).toBe(
      false,
    );
    expect(shouldScheduleCompaction(cacheCompactionWriteThreshold)).toBe(true);
  });
});

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
