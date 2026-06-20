import { tokenizeText, type ContentToken } from '$lib/events/content-tokens';
import type { CustomEmoji } from '$lib/protocol';
import { contentTokenRenderKey } from './content-token-plan';

export type EmojifiedTextToken = {
  readonly key: string;
  readonly token: ContentToken;
};

export function planEmojifiedText(
  text: string,
  emojis: readonly CustomEmoji[] = [],
): readonly EmojifiedTextToken[] {
  return tokenizeText(text, new Set(), emojis).map((token, index) => ({
    key: contentTokenRenderKey(token, index),
    token,
  }));
}
