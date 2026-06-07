import { describe, expect, it } from 'vitest';
import {
  estimateFeedRowHeight,
  markFeedRowDematerialized,
  markFeedRowMaterialized,
  recordFeedRowHeight,
} from '../../../src/lib/feed-surface/row-height-reservation';

const eventId = 'a'.repeat(64);

function eventRow(content: string, tags: readonly (readonly string[])[] = []) {
  return {
    kind: 'event' as const,
    node: {
      depth: 1,
      event: {
        id: eventId,
        pubkey: 'b'.repeat(64),
        created_at: 1,
        kind: 1,
        tags,
        content,
        sig: 'c'.repeat(128),
      },
      relays: ['wss://relay.example'],
    },
  };
}

describe('row height reservation tiers', () => {
  it('collapses enrichment reservation after dematerialize with reference tags', () => {
    const item = eventRow('hello', [['e', eventId]]);
    markFeedRowMaterialized('event:ref');
    recordFeedRowHeight({
      key: 'event:ref',
      item,
      widthPx: 640,
      heightPx: 400,
    });
    expect(
      estimateFeedRowHeight({ key: 'event:ref', item, widthPx: 640 }),
    ).toBe(400);

    markFeedRowDematerialized('event:ref');
    const collapsed = estimateFeedRowHeight({
      key: 'event:ref',
      item,
      widthPx: 640,
    });
    expect(collapsed).toBeLessThan(400);
    expect(collapsed).toBeLessThan(250);
  });

  it('ignores enriched measurements after dematerialize when shape hash is unchanged', () => {
    const item = eventRow('short reply', [['e', eventId]]);
    markFeedRowMaterialized('event:stable-shape');
    recordFeedRowHeight({
      key: 'event:stable-shape',
      item,
      widthPx: 640,
      heightPx: 360,
    });

    markFeedRowDematerialized('event:stable-shape');
    const collapsed = estimateFeedRowHeight({
      key: 'event:stable-shape',
      item,
      widthPx: 640,
    });

    expect(collapsed).toBeLessThan(360);
  });
});
