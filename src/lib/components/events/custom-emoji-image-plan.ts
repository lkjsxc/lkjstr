import type { CustomEmoji } from '$lib/protocol';

export type CustomEmojiImagePlan = {
  readonly src: string;
  readonly alt: string;
  readonly fallbackText: string;
  readonly loading: 'lazy';
  readonly decoding: 'async';
  readonly referrerPolicy: 'no-referrer';
};

export function planCustomEmojiImage(
  emoji: Pick<CustomEmoji, 'shortcode' | 'url'>,
): CustomEmojiImagePlan {
  const token = `:${emoji.shortcode}:`;
  return {
    src: emoji.url,
    alt: token,
    fallbackText: token,
    loading: 'lazy',
    decoding: 'async',
    referrerPolicy: 'no-referrer',
  };
}
