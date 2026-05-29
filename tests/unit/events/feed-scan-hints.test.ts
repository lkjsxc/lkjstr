import { beforeEach, describe, expect, it } from 'vitest';
import {
  chooseWarmSpan,
  clearFeedScanHintsForTests,
  feedScanHintMaxAgeMs,
  hintsForScan,
  putFeedScanHintForTests,
  recommendedSpanForFeedback,
  saveFeedScanHint,
} from '../../../src/lib/events/feed-scan-hints';
import { relaySegmentMaxSpan } from '../../../src/lib/events/relay-page-segments';

describe('feed scan hints', () => {
  beforeEach(() => clearFeedScanHintsForTests());

  it('recommends doubled, same, smaller, and non-growing spans', () => {
    expect(
      recommendedSpanForFeedback({
        currentSpanSeconds: 60,
        feedback: 'under-half',
      }),
    ).toBe(120);
    expect(
      recommendedSpanForFeedback({ currentSpanSeconds: 60, feedback: 'balanced' }),
    ).toBe(60);
    expect(
      recommendedSpanForFeedback({ currentSpanSeconds: 60, feedback: 'limit-hit' }),
    ).toBe(30);
    expect(
      recommendedSpanForFeedback({ currentSpanSeconds: 60, feedback: 'incomplete' }),
    ).toBe(60);
  });

  it('aggregates by conservative minimum across required relays', () => {
    expect(
      chooseWarmSpan({
        defaultSpanSeconds: 60,
        hints: [
          hint({ relayUrl: 'wss://a/', recommendedSpanSeconds: 120 }),
          hint({ relayUrl: 'wss://b/', recommendedSpanSeconds: 90 }),
        ],
      }),
    ).toBe(90);
  });

  it('falls back to default when no hints are supplied', () => {
    expect(chooseWarmSpan({ defaultSpanSeconds: 60, hints: [] })).toBe(60);
  });

  it('ignores stale hints when reading for a scan', async () => {
    putFeedScanHintForTests(
      hint({
        id: 'old',
        relayUrl: 'wss://a/',
        updatedAt: Date.now() - feedScanHintMaxAgeMs - 1,
      }),
    );

    expect(
      await hintsForScan({
        scanKey: 'scan',
        relays: ['wss://a/'],
        groupKey: 'group',
        filterKey: 'kind-1',
        direction: 'older',
      }),
    ).toEqual([]);
  });

  it('clamps spans to the supported scan range', async () => {
    await saveFeedScanHint({
      scanKey: 'scan',
      relayUrl: 'wss://a/',
      groupKey: 'group',
      filterKey: 'kind-1',
      direction: 'older',
      recommendedSpanSeconds: relaySegmentMaxSpan * 2,
      lastSpanSeconds: 0,
      lastFeedback: 'under-half',
    });

    const [stored] = await hintsForScan({
      scanKey: 'scan',
      relays: ['wss://a/'],
      groupKey: 'group',
      filterKey: 'kind-1',
      direction: 'older',
    });
    expect(stored?.recommendedSpanSeconds).toBe(relaySegmentMaxSpan);
    expect(stored?.lastSpanSeconds).toBe(1);
  });
});

function hint(
  overrides: Partial<ReturnType<typeof baseHint>> = {},
): ReturnType<typeof baseHint> {
  return { ...baseHint(), ...overrides };
}

function baseHint() {
  return {
    id: 'hint',
    scanKey: 'scan',
    relayUrl: 'wss://relay/',
    groupKey: 'group',
    filterKey: 'kind-1',
    direction: 'older' as const,
    recommendedSpanSeconds: 60,
    lastSpanSeconds: 60,
    lastFeedback: 'balanced' as const,
    updatedAt: Date.now(),
  };
}
