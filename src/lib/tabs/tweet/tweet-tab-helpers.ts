import {
  contentDerivedTags,
  contentWarningTag,
  type CustomEmoji,
  type NostrTag,
} from '$lib/protocol';
import type { TweetAttachment } from '$lib/tweet/draft-store';
import type { UploadSettings } from '$lib/tweet/media-upload';

export const defaultTweetUploadSettings: UploadSettings = {
  provider: 'blossom',
  customServer: '',
  server: '',
  protocol: 'blossom',
  noTransform: true,
};

export function tweetPublishContent(
  content: string,
  attachments: readonly TweetAttachment[],
): string {
  const urls = attachments.map((item) => item.url);
  return [content.trim(), ...urls].filter(Boolean).join('\n');
}

export function tweetPublishTags(input: {
  content: string;
  attachments: readonly TweetAttachment[];
  customEmojis: readonly CustomEmoji[];
  sensitive: boolean;
  warningReason: string;
}): NostrTag[] {
  const base = [
    ...input.attachments.map((item) => item.imeta),
    ...(input.sensitive ? [contentWarningTag(input.warningReason)] : []),
  ];
  return contentDerivedTags(input.content, input.customEmojis, base);
}

export function upsertCustomEmoji(
  items: readonly CustomEmoji[],
  emoji: CustomEmoji,
): CustomEmoji[] {
  return [...items.filter((item) => item.shortcode !== emoji.shortcode), emoji];
}
