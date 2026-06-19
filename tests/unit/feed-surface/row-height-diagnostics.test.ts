import { describe, expect, it } from 'vitest';
import {
  feedRowHeightDiagnostics,
  recordFeedRowAnchorCompensation,
  recordFeedRowHeight,
  recordFeedRowStaleObservation,
} from '../../../src/lib/feed-surface/row-height-reservation';

const eventId = 'd'.repeat(64);

function eventRow(content: string) {
  return {
    kind: 'event' as const,
    node: {
      depth: 1,
      event: {
        id: eventId,
        pubkey: 'b'.repeat(64),
        created_at: 1,
        kind: 1,
        tags: [],
        content,
        sig: 'c'.repeat(128),
      },
      relays: ['wss://relay.example'],
    },
  };
}

describe('row height diagnostics', () => {
  it('tracks anchor deltas, stale observations, and width buckets', () => {
    const before = feedRowHeightDiagnostics();

    recordFeedRowHeight({
      key: 'event:diag-narrow',
      item: eventRow('narrow'),
      widthPx: 360,
      heightPx: 220,
    });
    recordFeedRowHeight({
      key: 'event:diag-wide',
      item: eventRow('wide'),
      widthPx: 900,
      heightPx: 180,
    });
    recordFeedRowAnchorCompensation(12.6);
    recordFeedRowStaleObservation();

    const after = feedRowHeightDiagnostics();
    expect(after.anchorCompensations).toBe(before.anchorCompensations + 1);
    expect(after.lastAnchorCompensationDeltaPx).toBe(13);
    expect(after.staleObservationsDropped).toBe(
      before.staleObservationsDropped + 1,
    );
    expect(count(after, '320-479')).toBeGreaterThan(count(before, '320-479'));
    expect(count(after, '800-1023')).toBeGreaterThan(count(before, '800-1023'));
  });
});

function count(
  snapshot: ReturnType<typeof feedRowHeightDiagnostics>,
  bucket: string,
): number {
  return snapshot.widthBuckets.find((row) => row.key === bucket)?.count ?? 0;
}
