import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFeedCoverageForTests,
  saveFeedCoverage,
} from '../../../src/lib/events/feed-coverage-store';
import {
  coverageCoversRequirements,
  segmentCoverageDecision,
  type CoverageRequirement,
} from '../../../src/lib/events/feed-coverage-query';

const requirement: CoverageRequirement = {
  groupKey: 'group',
  relayUrl: 'wss://relay/',
  filterKey: 'kind-1',
  since: 10,
  until: 20,
};

describe('feed coverage query', () => {
  beforeEach(() => clearFeedCoverageForTests());

  it('covers when all requirements have complete matching rows', () => {
    expect(
      coverageCoversRequirements([requirement], [row('complete')]),
    ).toEqual({ kind: 'covered' });
  });

  it('rejects a missing relay requirement', () => {
    expect(
      coverageCoversRequirements(
        [requirement, { ...requirement, relayUrl: 'wss://other/' }],
        [row('complete')],
      ).kind,
    ).toBe('missing');
  });

  it('rejects dense and incomplete rows', () => {
    expect(coverageCoversRequirements([requirement], [row('dense')]).kind).toBe(
      'missing',
    );
    expect(
      coverageCoversRequirements([requirement], [row('incomplete')]).kind,
    ).toBe('missing');
  });

  it('rejects different ranges and semantic filters', () => {
    expect(
      coverageCoversRequirements([requirement], [row('complete', { since: 9 })])
        .kind,
    ).toBe('missing');
    expect(
      coverageCoversRequirements(
        [requirement],
        [row('complete', { filterKey: 'kind-6' })],
      ).kind,
    ).toBe('missing');
  });

  it('reads stored coverage for a feed decision', async () => {
    await saveFeedCoverage({
      feedKey: 'feed',
      ...requirement,
      status: 'complete',
    });

    expect(
      await segmentCoverageDecision({
        feedKey: 'feed',
        requirements: [requirement],
      }),
    ).toEqual({ kind: 'covered' });
  });
});

function row(
  status: 'complete' | 'dense' | 'incomplete',
  overrides: Partial<CoverageRequirement> = {},
) {
  return {
    id: 'id',
    feedKey: 'feed',
    ...requirement,
    ...overrides,
    status,
    updatedAt: 1,
  };
}
