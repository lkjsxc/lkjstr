import { describe, expect, it } from 'vitest';
import {
  intervalUnionCovers,
  normalizeCoverageIntervals,
} from '../../../src/lib/events/feed-coverage-intervals';

describe('feed coverage intervals', () => {
  it('merges adjacent intervals', () => {
    expect(
      normalizeCoverageIntervals([
        { since: 160, until: 220 },
        { since: 100, until: 160 },
      ]),
    ).toEqual([{ since: 100, until: 220 }]);
  });

  it('merges overlapping intervals', () => {
    expect(
      normalizeCoverageIntervals([
        { since: 100, until: 180 },
        { since: 160, until: 220 },
      ]),
    ).toEqual([{ since: 100, until: 220 }]);
  });

  it('preserves separated intervals', () => {
    expect(
      normalizeCoverageIntervals([
        { since: 100, until: 160 },
        { since: 170, until: 220 },
      ]),
    ).toEqual([
      { since: 100, until: 160 },
      { since: 170, until: 220 },
    ]);
  });

  it('rejects negative and zero-width rows', () => {
    expect(
      normalizeCoverageIntervals([
        { since: 100, until: 100 },
        { since: 160, until: 120 },
        { since: 100, until: 160 },
      ]),
    ).toEqual([{ since: 100, until: 160 }]);
  });

  it('reports exact gaps', () => {
    expect(
      intervalUnionCovers(
        { since: 100, until: 260 },
        [
          { since: 100, until: 160 },
          { since: 180, until: 220 },
          { since: 240, until: 260 },
        ],
      ),
    ).toEqual({
      kind: 'missing',
      gaps: [
        { since: 160, until: 180 },
        { since: 220, until: 240 },
      ],
    });
  });

  it('covers a target contained by a larger row', () => {
    expect(
      intervalUnionCovers(
        { since: 120, until: 180 },
        [{ since: 100, until: 220 }],
      ),
    ).toEqual({ kind: 'covered' });
  });

  it('covers a target spanning multiple rows', () => {
    expect(
      intervalUnionCovers(
        { since: 100, until: 220 },
        [
          { since: 100, until: 160 },
          { since: 160, until: 220 },
        ],
      ),
    ).toEqual({ kind: 'covered' });
  });

  it('fails a target extending below the first row', () => {
    expect(
      intervalUnionCovers(
        { since: 90, until: 160 },
        [{ since: 100, until: 160 }],
      ),
    ).toEqual({
      kind: 'missing',
      gaps: [{ since: 90, until: 100 }],
    });
  });

  it('fails a target extending above the last row', () => {
    expect(
      intervalUnionCovers(
        { since: 100, until: 180 },
        [{ since: 100, until: 160 }],
      ),
    ).toEqual({
      kind: 'missing',
      gaps: [{ since: 160, until: 180 }],
    });
  });
});
