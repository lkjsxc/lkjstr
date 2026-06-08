import { describe, expect, it } from 'vitest';
import {
  estimateHeightFromFeatures,
  featuresForFeedItem,
} from '../../../src/lib/feed-surface/feed-geometry-features';

const target = 'd'.repeat(64);

function eventRow(kind: number, content: string, tags = [['e', target]]) {
  return {
    kind: 'event' as const,
    node: {
      depth: 0,
      event: {
        id: 'a'.repeat(64),
        pubkey: 'b'.repeat(64),
        created_at: 1,
        kind,
        tags,
        content,
        sig: 'c'.repeat(128),
      },
      relays: ['wss://relay.example'],
    },
  };
}

describe('feed geometry features', () => {
  it('uses rendered action text for repost geometry instead of raw JSON', () => {
    const hugeTargetJson = JSON.stringify({ content: 'x'.repeat(20_000) });
    const repost = featuresForFeedItem(eventRow(6, hugeTargetJson), 640);
    const note = featuresForFeedItem(eventRow(1, hugeTargetJson), 640);

    expect(repost.contentLength).toBe('reposted'.length);
    expect(estimateHeightFromFeatures(repost)).toBeLessThan(
      estimateHeightFromFeatures(note),
    );
  });
});
