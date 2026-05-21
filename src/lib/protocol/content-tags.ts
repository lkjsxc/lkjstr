import { decodeEntity } from './nip19';
import { isEventId, isPubkey, type NostrTag } from './event';
import { customEmojiTokenText, type CustomEmoji } from './nip30';

const nostrEntityPattern = /\bnostr:([a-z0-9]+)/giu;

export function contentDerivedTags(
  content: string,
  emoji: readonly CustomEmoji[] = [],
  baseTags: readonly NostrTag[] = [],
): NostrTag[] {
  const tags = [...baseTags.map((tag) => [...tag])];
  for (const tag of mentionTags(content)) appendUnique(tags, tag);
  for (const tag of emojiTags(content, emoji)) appendUnique(tags, tag);
  return tags;
}

export function mentionTags(content: string): NostrTag[] {
  const tags: NostrTag[] = [];
  for (const match of content.matchAll(nostrEntityPattern)) {
    const decoded = decodeEntity(match[1] ?? '');
    if (!decoded) continue;
    if (decoded.type === 'npub' && isPubkey(decoded.data))
      tags.push(['p', decoded.data]);
    if (decoded.type === 'nprofile' && isPubkey(decoded.data.pubkey))
      tags.push(['p', decoded.data.pubkey, decoded.data.relays?.[0] ?? '']);
    if (decoded.type === 'note' && isEventId(decoded.data))
      tags.push(['q', decoded.data]);
    if (decoded.type === 'nevent' && isEventId(decoded.data.id))
      tags.push(['q', decoded.data.id, decoded.data.relays?.[0] ?? '']);
  }
  return tags;
}

export function emojiTags(
  content: string,
  emoji: readonly CustomEmoji[],
): NostrTag[] {
  const byCode = new Map(emoji.map((item) => [item.shortcode, item]));
  return [...byCode.values()]
    .filter((item) => content.includes(customEmojiTokenText(item.shortcode)))
    .map((item) => ['emoji', item.shortcode, item.url]);
}

function appendUnique(tags: NostrTag[], tag: NostrTag): void {
  const key = tagKey(tag);
  const existing = tags.findIndex((item) => tagKey(item) === key);
  if (existing < 0) {
    tags.push(tag);
    return;
  }
  if (!tags[existing]?.[2] && tag[2]) tags[existing] = tag;
}

function tagKey(tag: readonly string[]): string {
  return `${tag[0] ?? ''}\u0000${tag[1] ?? ''}`;
}
