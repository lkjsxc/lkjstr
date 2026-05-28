import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFeedCoverageForTests,
  coverageForFeed,
} from '../../../src/lib/events/feed-coverage-store';
import { recordScanCoverage } from '../../../src/lib/events/relay-page-scan-diagnostics';
import type { RelayGroupPageRequest } from '../../../src/lib/events/relay-page';

describe('feed coverage relay-specific records', () => {
  beforeEach(() => clearFeedCoverageForTests());

  it('stores relay-specific density counts and feedback metadata', async () => {
    await recordScanCoverage(
      { key: 'feed', pageSize: 10, direction: 'older' } as RelayGroupPageRequest,
      'group',
      ['wss://dense/', 'wss://sparse/'],
      [{ kinds: [1], since: 10, until: 20 }],
      'dense',
      {
        feedback: 'limit-hit',
        direction: 'older',
        spanSeconds: 10,
        relayRows: [
          row('wss://dense/', 5, 5),
          row('wss://sparse/', 1, 5),
        ],
      },
    );

    expect(await coverageForFeed('feed')).toEqual([
      expect.objectContaining({
        relayUrl: 'wss://dense/',
        eventCount: 5,
        limit: 5,
        feedback: 'limit-hit',
        spanSeconds: 10,
      }),
      expect.objectContaining({
        relayUrl: 'wss://sparse/',
        eventCount: 1,
        limit: 5,
        feedback: 'limit-hit',
        spanSeconds: 10,
      }),
    ]);
  });
});

function row(relay: string, eventCount: number, limit: number) {
  const hitLimit = eventCount >= limit;
  return {
    relay,
    dense: hitLimit,
    hitLimit,
    underHalfLimit: !hitLimit && eventCount <= Math.floor(limit / 2),
    observedCount: eventCount,
    limit,
    eventCount,
    uniqueCount: eventCount,
  };
}
