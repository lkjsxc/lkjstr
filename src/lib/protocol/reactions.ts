import {
  customEmojiTag,
  customEmojiTokenText,
  type CustomEmoji,
} from './nip30';
import type { NostrEvent } from './event';

const customEmojiReactionPattern = /^:([A-Za-z0-9_-]+):$/u;

export type ReactionKind = 'like' | 'dislike' | 'emoji' | 'custom-emoji';

export type ParsedReaction = {
  readonly kind: ReactionKind;
  readonly display: string;
  readonly emoji?: CustomEmoji;
};

export function reactionTargetEventId(event: NostrEvent): string | undefined {
  return event.tags.filter((tag) => tag[0] === 'e' && tag[1]).at(-1)?.[1];
}

export function parseReaction(event: NostrEvent): ParsedReaction {
  const content = reactionContent(event);
  if (content === '+') return { kind: 'like', display: 'heart' };
  if (content === '-') return { kind: 'dislike', display: '-' };
  const emoji = customEmojiReaction(event, content);
  if (emoji) return { kind: 'custom-emoji', display: content, emoji };
  return { kind: 'emoji', display: content };
}

export function reactionContent(event: Pick<NostrEvent, 'content'>): string {
  const text = event.content.trim();
  return text || '+';
}

export function customEmojiReaction(
  event: Pick<NostrEvent, 'tags'>,
  content: string,
): CustomEmoji | undefined {
  const shortcode = customEmojiReactionShortcode(content);
  if (!shortcode) return undefined;
  return event.tags
    .map(customEmojiTag)
    .find((emoji) => emoji?.shortcode === shortcode);
}

export function customEmojiReactionShortcode(
  content: string,
): string | undefined {
  return customEmojiReactionPattern.exec(content)?.[1];
}

export function customEmojiReactionContent(emoji: CustomEmoji): string {
  return customEmojiTokenText(emoji.shortcode);
}
