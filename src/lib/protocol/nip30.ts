import type { NostrEvent } from './event';

export type CustomEmoji = {
  readonly shortcode: string;
  readonly url: string;
  readonly address?: string;
};

const shortcodePattern = /^[A-Za-z0-9_]+$/;
const incomingShortcodePattern = /^[A-Za-z0-9_-]+$/;
const customEmojiInputPattern =
  /^:([^:]+):(https:\/\/\S+?)(?::(30030:[0-9a-f]{64}:.+))?$/u;
const emojiSetAddressPattern = /^30030:[0-9a-f]{64}:[^\s:]+$/u;

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
  if (!validIncomingCustomEmojiShortcode(shortcode)) return undefined;
  if (!isHttpsUrl(url)) return undefined;
  const address = tag[3];
  return validCustomEmojiAddress(address)
    ? { shortcode, url, address }
    : { shortcode, url };
}

export function validCustomEmojiShortcode(value: string): boolean {
  return shortcodePattern.test(value);
}

export function validIncomingCustomEmojiShortcode(value: string): boolean {
  return incomingShortcodePattern.test(value);
}

export function validCustomEmojiUrl(value: string): boolean {
  return isHttpsUrl(value);
}

export function validCustomEmojiAddress(
  value: string | undefined,
): value is string {
  return Boolean(value && emojiSetAddressPattern.test(value));
}

export function customEmojiTokenText(shortcode: string): string {
  return `:${shortcode}:`;
}

export function parseCustomEmojiInput(value: string): CustomEmoji | undefined {
  const match = customEmojiInputPattern.exec(value.trim());
  if (!match) return undefined;
  const [, shortcode = '', url = ''] = match;
  if (!validCustomEmojiShortcode(shortcode)) return undefined;
  if (!validCustomEmojiUrl(url)) return undefined;
  const address = match[3];
  return validCustomEmojiAddress(address)
    ? { shortcode, url, address }
    : { shortcode, url };
}

export function customEmojiTagParts(emoji: CustomEmoji): string[] {
  return emoji.address
    ? ['emoji', emoji.shortcode, emoji.url, emoji.address]
    : ['emoji', emoji.shortcode, emoji.url];
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
