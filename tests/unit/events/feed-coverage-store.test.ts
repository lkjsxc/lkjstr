import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearFeedCoverageForTests,
  coverageForFeed,
  deleteFeedCoverageForFeeds,
  saveFeedCoverage,
} from '../../../src/lib/events/feed-coverage-store';

describe('feed coverage store', () => {
  beforeEach(() => clearFeedCoverageForTests());

  it('persists coverage records through the memory fallback', async () => {
    await saveFeedCoverage({
      feedKey: 'home',
      relayUrl: 'wss://relay.example/',
      groupKey: 'fallback:0',
      filterKey: 'kind-1',
      status: 'complete',
      since: 1,
      until: 2,
    });

    expect(await coverageForFeed('home')).toEqual([
      expect.objectContaining({
        feedKey: 'home',
        status: 'complete',
        since: 1,
        until: 2,
      }),
    ]);
  });

  it('deletes coverage by feed key', async () => {
    await saveFeedCoverage({
      feedKey: 'home',
      relayUrl: 'wss://relay.example/',
      groupKey: 'fallback:0',
      filterKey: 'kind-1',
      status: 'dense',
    });

    await deleteFeedCoverageForFeeds(['home']);

    expect(await coverageForFeed('home')).toEqual([]);
  });
});
