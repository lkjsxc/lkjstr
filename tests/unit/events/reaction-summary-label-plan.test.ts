import { describe, expect, it } from 'vitest';
import {
  reactionGroupKey,
  reactionSummaryCountText,
  reactionSummaryIcon,
  reactionSummaryLabel,
  reactionToggleLabel,
  repostToggleLabel,
} from '../../../src/lib/components/events/reaction-summary-label-plan';

describe('reaction summary label plan', () => {
  it('keeps reaction keys stable across content and custom emoji identity', () => {
    expect(
      reactionGroupKey({
        content: ':party:',
        emoji: {
          shortcode: 'party',
          url: 'https://emoji.example/party.png',
          address: '30030:pubkey:party',
        },
      }),
    ).toBe(':party::https://emoji.example/party.png:30030:pubkey:party');
  });

  it('maps retained reaction labels and icons', () => {
    expect(reactionSummaryLabel('+')).toBe('like');
    expect(reactionSummaryLabel('heart')).toBe('like');
    expect(reactionSummaryLabel('-')).toBe('dislike');
    expect(reactionSummaryLabel(':party:')).toBe(':party:');
    expect(reactionSummaryIcon('+')).toBe('like');
    expect(reactionSummaryIcon('-')).toBe('dislike');
    expect(reactionSummaryIcon(':party:')).toBe('custom');
  });

  it('plans retained count text and trigger labels', () => {
    expect(reactionSummaryCountText(2)).toBe('2');
    expect(reactionToggleLabel(false, 2, 'like')).toBe('Show 2 like reactions');
    expect(reactionToggleLabel(true, 1, 'dislike')).toBe(
      'Hide 1 dislike reaction',
    );
    expect(repostToggleLabel(false, 2)).toBe('Show 2 reposts');
    expect(repostToggleLabel(true, 1)).toBe('Hide 1 repost');
  });
});
