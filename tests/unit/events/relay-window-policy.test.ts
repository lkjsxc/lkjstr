import { describe, expect, it } from 'vitest';
import {
  classifyWindowFeedback,
  nextAdaptiveRelayWindow,
} from '../../../src/lib/events/relay-window-policy';
import {
  initialRelayPageSegment,
  relaySegmentMaxSpan,
  type RelayPageSegment,
} from '../../../src/lib/events/relay-page-segments';

describe('relay window policy', () => {
  it('starts older scans at twelve minutes', () => {
    const initial = initialRelayPageSegment({
      direction: 'older',
      before: { createdAt: 1_000, id: 'f'.repeat(64) },
      now: 1_000,
    });

    expect(span(initial)).toBe(12 * 60);
  });

  it('classifies adaptive feedback from completion and limit state', () => {
    expect(
      classifyWindowFeedback({
        contacted: false,
        complete: true,
        hitLimit: false,
        underHalfLimit: true,
      }),
    ).toBeUndefined();
    expect(
      classifyWindowFeedback({
        complete: false,
        hitLimit: true,
        underHalfLimit: false,
      }),
    ).toBe('incomplete');
    expect(
      classifyWindowFeedback({
        complete: true,
        hitLimit: true,
        underHalfLimit: false,
      }),
    ).toBe('limit-hit');
    expect(
      classifyWindowFeedback({
        complete: true,
        hitLimit: false,
        underHalfLimit: true,
      }),
    ).toBe('under-half');
    expect(
      classifyWindowFeedback({
        complete: true,
        hitLimit: false,
        underHalfLimit: false,
      }),
    ).toBe('balanced');
  });

  it('doubles under-half windows and keeps balanced spans', () => {
    const current = segment(500, 620);
    const underHalf = nextAdaptiveRelayWindow(
      current,
      { direction: 'older' },
      'under-half',
    );
    const balanced = nextAdaptiveRelayWindow(
      current,
      { direction: 'older' },
      'balanced',
    );

    expect(underHalf).toEqual({
      kind: 'advance',
      segment: { since: 261, until: 501, depth: 0, span: 240 },
    });
    expect(balanced).toEqual({
      kind: 'advance',
      segment: { since: 381, until: 501, depth: 0, span: 120 },
    });
  });

  it('caps under-half growth at the maximum span', () => {
    const next = nextAdaptiveRelayWindow(
      segment(relaySegmentMaxSpan, relaySegmentMaxSpan * 2),
      { direction: 'older' },
      'under-half',
    );

    expect(next.kind).toBe('advance');
    if (next.kind === 'advance')
      expect(span(next.segment)).toBe(relaySegmentMaxSpan);
  });

  it('splits limit-hit older windows newer half first', () => {
    expect(
      nextAdaptiveRelayWindow(
        segment(0, 100),
        { direction: 'older' },
        'limit-hit',
      ),
    ).toEqual({
      kind: 'split',
      segments: [
        { since: 50, until: 100, depth: 1, span: 50 },
        { since: 0, until: 51, depth: 1, span: 51 },
      ],
    });
  });

  it('returns terminal for unsplittable or repeated incomplete windows', () => {
    expect(
      nextAdaptiveRelayWindow(
        { since: 10, until: 11, depth: 0, span: 1 },
        { direction: 'older' },
        'limit-hit',
      ),
    ).toEqual({ kind: 'terminal' });
    expect(
      nextAdaptiveRelayWindow(
        { since: 0, until: 100, depth: 1, span: 100 },
        { direction: 'older' },
        'incomplete',
      ),
    ).toEqual({ kind: 'terminal' });
  });

  it('orders newer limit-hit splits from older half toward the cursor', () => {
    expect(
      nextAdaptiveRelayWindow(
        segment(0, 100),
        { direction: 'newer' },
        'limit-hit',
      ),
    ).toEqual({
      kind: 'split',
      segments: [
        { since: 0, until: 51, depth: 1, span: 51 },
        { since: 50, until: 100, depth: 1, span: 50 },
      ],
    });
  });
});

function segment(since: number, until: number): RelayPageSegment {
  return { since, until, depth: 0, span: until - since };
}

function span(value: RelayPageSegment): number {
  return (value.until ?? 0) - (value.since ?? 0);
}
