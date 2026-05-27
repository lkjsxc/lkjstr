import { describe, expect, it } from 'vitest';
import {
  mergeTimelineReducerState,
  createEmptyTimelineReducerState,
} from '../../../src/lib/timeline/timeline-reducer';
import type { TimelineItem } from '../../../src/lib/timeline/timeline-store';
import type { NostrEvent } from '../../../src/lib/protocol';

describe('timeline-reducer', () => {
  it('keeps newer events above older merged pages', () => {
    const newer = item('new', 300);
    const older = item('old', 100);
    const state = mergeTimelineReducerState(
      createEmptyTimelineReducerState(),
      [newer],
      180,
    );
    const merged = mergeTimelineReducerState(state, [older], 180);
    expect(merged.items.map((row) => row.event.id)).toEqual(['new', 'old']);
  });

  it('dedupes duplicate ids from cache-after-live', () => {
    const live = item('shared', 200);
    const cache = item('shared', 200);
    const merged = mergeTimelineReducerState(
      mergeTimelineReducerState(createEmptyTimelineReducerState(), [live], 180),
      [cache],
      180,
    );
    expect(merged.items).toHaveLength(1);
  });
});

function item(id: string, created_at: number): TimelineItem {
  return { event: event(id, created_at), relays: ['relay'] };
}

function event(id: string, created_at: number): NostrEvent {
  return {
    id,
    pubkey: '11'.repeat(32),
    created_at,
    kind: 1,
    tags: [],
    content: id,
    sig: '22'.repeat(64),
  };
}
