import type { NostrEvent } from './event';

export type CustomEmoji = {
  readonly shortcode: string;
  readonly url: string;
};

const shortcodePattern = /^[A-Za-z0-9_+-]+$/;

export function customEmojis(event: NostrEvent): CustomEmoji[] {
  const byCode = new Map<string, CustomEmoji>();
  for (const tag of event.tags) {
    const emoji = customEmojiTag(tag);
    if (emoji) byCode.set(emoji.shortcode, emoji);
  }
  return [...byCode.values()];
}

export function customEmojiTag(
  tag: readonly string[],
): CustomEmoji | undefined {
  const [name, shortcode, url] = tag;
  if (name !== 'emoji' || !shortcode || !url) return undefined;
  if (!shortcodePattern.test(shortcode)) return undefined;
  if (!isHttpsUrl(url)) return undefined;
  return { shortcode, url };
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
