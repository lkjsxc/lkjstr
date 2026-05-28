import { describe, expect, it } from 'vitest';
import {
  initialRelayPageSegment,
  nextGrownRelayPageSegment,
  relaySegmentInitialSpan,
  relaySegmentMaxSpan,
  splitRelayPageSegment,
} from '../../../src/lib/events/relay-page-segments';

describe('relay page segments', () => {
  it('grows older scans from the initial span up to the max span', () => {
    const initial = initialRelayPageSegment({
      direction: 'older',
      before: { createdAt: 1_000_000, id: 'f'.repeat(64) },
      now: 1_000_000,
    });
    const grown = nextGrownRelayPageSegment(initial, {
      direction: 'older',
      before: { createdAt: 1_000_000, id: 'f'.repeat(64) },
    });

    expect(span(initial)).toBe(12 * 60);
    expect(span(initial)).toBe(relaySegmentInitialSpan);
    expect(grown?.until).toBe((initial.since ?? 0) + 1);
    expect(grown ? span(grown) : 0).toBe(24 * 60);
  });

  it('splits older dense segments newer half first', () => {
    const [newer, older] = splitRelayPageSegment(
      { since: 0, until: 100, depth: 0, span: 100 },
      'older',
    );

    expect(newer).toEqual({ since: 50, until: 100, depth: 1, span: 50 });
    expect(older).toEqual({ since: 0, until: 51, depth: 1, span: 51 });
  });

  it('caps growth at the maximum span', () => {
    const grown = nextGrownRelayPageSegment(
      {
        since: relaySegmentMaxSpan,
        until: relaySegmentMaxSpan * 2,
        depth: 0,
        span: relaySegmentMaxSpan,
      },
      { direction: 'older' },
    );

    expect(grown ? span(grown) : 0).toBe(relaySegmentMaxSpan);
  });
});

function span(segment: { readonly since?: number; readonly until?: number }) {
  return (segment.until ?? 0) - (segment.since ?? 0);
}
