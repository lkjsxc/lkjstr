import { describe, expect, it } from 'vitest';
import { planCustomEmojiImage } from '../../../src/lib/components/events/custom-emoji-image-plan';

describe('custom emoji image plan', () => {
  it('keeps retained shortcode fallback and safe image attributes', () => {
    expect(
      planCustomEmojiImage({
        shortcode: 'party',
        url: 'https://emoji.example/party.png',
      }),
    ).toEqual({
      src: 'https://emoji.example/party.png',
      alt: ':party:',
      fallbackText: ':party:',
      loading: 'lazy',
      decoding: 'async',
      referrerPolicy: 'no-referrer',
    });
  });
});
