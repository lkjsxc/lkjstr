import { describe, expect, it } from 'vitest';
import {
  longestAuthorRun,
  userTimelineCachePolicy,
} from '../../../src/lib/user-timeline/user-timeline-cache-policy';
import type { TimelineItem } from '../../../src/lib/timeline/timeline-store';

describe('user timeline cache policy', () => {
  it('renders proven coverage normally', () => {
    const items = [item('a', '1')];
    expect(
      userTimelineCachePolicy({
        items,
        coverageProven: true,
        authorSetMatches: true,
      }),
    ).toMatchObject({ mode: 'coverage-proven', items });
  });

  it('holds mismatched author-set cache', () => {
    expect(
      userTimelineCachePolicy({
        items: [item('a', '1')],
        coverageProven: false,
        authorSetMatches: false,
      }),
    ).toMatchObject({ mode: 'hold-cache', items: [] });
  });

  it('caps unbiased previews and holds dominant runs', () => {
    const preview = Array.from({ length: 12 }, (_, index) =>
      item(String.fromCharCode(97 + (index % 2)), String(index)),
    );
    expect(longestAuthorRun(preview)).toBe(1);
    expect(
      userTimelineCachePolicy({
        items: preview,
        coverageProven: false,
        authorSetMatches: true,
      }).items,
    ).toHaveLength(10);

    const dominant = Array.from({ length: 11 }, (_, index) =>
      item('a', String(index)),
    );
    expect(
      userTimelineCachePolicy({
        items: dominant,
        coverageProven: false,
        authorSetMatches: true,
      }),
    ).toMatchObject({ mode: 'hold-cache', items: [] });
  });
});

function item(pubkeyPrefix: string, idPrefix: string): TimelineItem {
  return {
    event: {
      id: idPrefix.repeat(64).slice(0, 64),
      pubkey: pubkeyPrefix.repeat(64).slice(0, 64),
      sig: '3'.repeat(128),
      kind: 1,
      tags: [],
      created_at: Number(idPrefix) || 1,
      content: '',
    },
    relays: [],
  };
}
