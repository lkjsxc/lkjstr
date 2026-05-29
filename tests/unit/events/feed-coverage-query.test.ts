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

  it('covers with two adjacent complete rows', () => {
    expect(
      coverageCoversRequirements(
        [{ ...requirement, since: 100, until: 220 }],
        [
          row('complete', { since: 100, until: 160 }),
          row('complete', { since: 160, until: 220 }),
        ],
      ),
    ).toEqual({ kind: 'covered' });
  });

  it('covers with overlapping complete rows', () => {
    expect(
      coverageCoversRequirements(
        [{ ...requirement, since: 100, until: 220 }],
        [
          row('complete', { since: 100, until: 180 }),
          row('complete', { since: 160, until: 220 }),
        ],
      ),
    ).toEqual({ kind: 'covered' });
  });

  it('covers when one row contains the requirement', () => {
    expect(
      coverageCoversRequirements(
        [{ ...requirement, since: 120, until: 180 }],
        [row('complete', { since: 100, until: 220 })],
      ),
    ).toEqual({ kind: 'covered' });
  });

  it('rejects a one-second gap', () => {
    const decision = coverageCoversRequirements(
      [{ ...requirement, since: 100, until: 260 }],
      [
        row('complete', { since: 100, until: 160 }),
        row('complete', { since: 161, until: 260 }),
      ],
    );
    expect(decision.kind).toBe('missing');
    expect(decision.kind === 'missing' ? decision.missing[0]?.gaps : []).toEqual(
      [{ since: 160, until: 161 }],
    );
  });

  it('rejects a missing relay requirement', () => {
    expect(
      coverageCoversRequirements(
        [requirement, { ...requirement, relayUrl: 'wss://other/' }],
        [row('complete')],
      ).kind,
    ).toBe('missing');
  });

  it('rejects wrong group and semantic filter', () => {
    expect(
      coverageCoversRequirements(
        [requirement],
        [row('complete', { groupKey: 'other-group' })],
      ).kind,
    ).toBe('missing');
    expect(
      coverageCoversRequirements(
        [requirement],
        [row('complete', { filterKey: 'kind-6' })],
      ).kind,
    ).toBe('missing');
  });

  it.each(['dense', 'incomplete', 'unresolved', 'failed'] as const)(
    'rejects %s rows',
    (status) => {
      expect(coverageCoversRequirements([requirement], [row(status)]).kind).toBe(
        'missing',
      );
    },
  );

  it('rejects missing since and until bounds', () => {
    expect(
      coverageCoversRequirements([{ ...requirement, since: undefined }], [
        row('complete'),
      ]).kind,
    ).toBe('missing');
    expect(
      coverageCoversRequirements([{ ...requirement, until: undefined }], [
        row('complete'),
      ]).kind,
    ).toBe('missing');
  });

  it('requires every relay in multi-relay requirements', () => {
    const decision = coverageCoversRequirements(
      [requirement, { ...requirement, relayUrl: 'wss://relay-b/' }],
      [row('complete')],
    );
    expect(decision.kind).toBe('missing');
    expect(decision.kind === 'missing' ? decision.missing : []).toMatchObject([
      { relayUrl: 'wss://relay-b/' },
    ]);
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
  status: 'complete' | 'dense' | 'incomplete' | 'unresolved' | 'failed',
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
