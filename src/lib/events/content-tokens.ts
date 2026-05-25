import { decodeEntity } from '../protocol/nip19';
import { createBoundedMap } from '../fp/bounded-map';
import {
  customEmojis,
  isEventId,
  isPubkey,
  type CustomEmoji,
  type NostrEvent,
} from '../protocol';
import { contentAttachments, type ContentAttachment } from './content-media';

export type ContentToken =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'url'; readonly url: string; readonly text: string }
  | {
      readonly type: 'profile';
      readonly pubkey: string;
      readonly text: string;
      readonly rawText: string;
      readonly relays: readonly string[];
    }
  | {
      readonly type: 'event';
      readonly eventId: string;
      readonly text: string;
      readonly rawText: string;
      readonly relays: readonly string[];
    }
  | {
      readonly type: 'custom-emoji';
      readonly shortcode: string;
      readonly url: string;
      readonly address?: string;
      readonly text: string;
    };

const tokenPattern =
  /(:[A-Za-z0-9_-]+:)|\b(?:nostr:([a-z0-9]+)|https:\/\/[^\s<>"']+)/gi;
const tokenCache = createBoundedMap<string, ContentToken[]>({
  maxSize: 1000,
  ttlMs: 5 * 60 * 1000,
});
const maxTokens = 512;
const maxEntities = 256;
const maxUrls = 128;
const maxEmojiLookup = 256;

export function contentTokens(event: NostrEvent): ContentToken[] {
  const key = contentTokenCacheKey(event);
  const cached = tokenCache.get(key);
  if (cached) return cached;
  const hiddenUrls = new Set(
    contentAttachments(event)
      .filter(isEmbeddedMedia)
      .slice(0, maxUrls)
      .map((attachment) => attachment.url),
  );
  const tokens = tokenizeText(
    event.content,
    hiddenUrls,
    customEmojis(event).slice(0, maxEmojiLookup),
  );
  tokenCache.set(key, tokens);
  return tokens;
}

export function tokenizeText(
  content: string,
  hiddenUrls: ReadonlySet<string> = new Set(),
  emoji: readonly CustomEmoji[] = [],
): ContentToken[] {
  const tokens: ContentToken[] = [];
  const emojiByText = new Map(
    emoji.slice(0, maxEmojiLookup).map((item) => [`:${item.shortcode}:`, item]),
  );
  let index = 0;
  let entities = 0;
  let urls = 0;
  for (const match of content.matchAll(tokenPattern)) {
    if (tokens.length >= maxTokens) break;
    const full = match[0] ?? '';
    const start = match.index ?? 0;
    if (start > index) pushText(tokens, content.slice(index, start));
    index = start + full.length;
    if (match[1]) {
      const emojiHit = emojiByText.get(full);
      tokens.push(
        emojiHit
          ? { type: 'custom-emoji', text: full, ...emojiHit }
          : { type: 'text', text: full },
      );
      continue;
    }
    const raw = cleanToken(full);
    const suffix = full.slice(raw.length);
    if (!raw) continue;
    const entity = match[2];
    if (entity) {
      entities += 1;
      const token =
        entities <= maxEntities ? entityToken(raw, entity) : undefined;
      tokens.push(token ?? { type: 'text', text: raw });
      pushText(tokens, suffix);
      continue;
    }
    urls += 1;
    if (!hiddenUrls.has(raw) && urls <= maxUrls)
      tokens.push({ type: 'url', url: raw, text: raw });
    else if (urls > maxUrls) pushText(tokens, raw);
    pushText(tokens, suffix);
  }
  if (index < content.length) pushText(tokens, content.slice(index));
  return mergeText(tokens).slice(0, maxTokens);
}

export function contentTokenCacheSizeForTests(): number {
  return contentTokenCacheSize();
}

export function contentTokenCacheSize(): number {
  return tokenCache.size();
}

export function clearContentTokenCacheForTests(): void {
  tokenCache.clear();
}

function entityToken(raw: string, value: string): ContentToken | undefined {
  const decoded = decodeEntity(value);
  if (!decoded) return undefined;
  if (decoded.type === 'npub' && isPubkey(decoded.data))
    return profileToken(raw, decoded.data, []);
  if (decoded.type === 'nprofile' && isPubkey(decoded.data.pubkey))
    return profileToken(raw, decoded.data.pubkey, decoded.data.relays ?? []);
  if (decoded.type === 'note' && isEventId(decoded.data))
    return eventToken(raw, decoded.data, []);
  if (decoded.type === 'nevent' && isEventId(decoded.data.id))
    return eventToken(raw, decoded.data.id, decoded.data.relays ?? []);
  return undefined;
}

function profileToken(
  raw: string,
  pubkey: string,
  relays: readonly string[],
): ContentToken {
  return { type: 'profile', pubkey, text: raw, rawText: raw, relays };
}

function eventToken(
  raw: string,
  eventId: string,
  relays: readonly string[],
): ContentToken {
  return {
    type: 'event',
    eventId,
    text: `event:${eventId.slice(0, 8)}`,
    rawText: raw,
    relays,
  };
}

function isEmbeddedMedia(attachment: ContentAttachment): boolean {
  return ['image', 'video', 'audio'].includes(attachment.type);
}

function cleanToken(value: string): string {
  return value.replace(/[),.;:!?]+$/u, '');
}

function pushText(tokens: ContentToken[], text: string): void {
  if (text.length > 0) tokens.push({ type: 'text', text });
}

function mergeText(tokens: readonly ContentToken[]): ContentToken[] {
  return tokens.reduce<ContentToken[]>((merged, token) => {
    const previous = merged.at(-1);
    if (previous?.type === 'text' && token.type === 'text') {
      merged[merged.length - 1] = {
        type: 'text',
        text: previous.text + token.text,
      };
      return merged;
    }
    merged.push(token);
    return merged;
  }, []);
}

function contentTokenCacheKey(event: NostrEvent): string {
  const emojiTags = event.tags
    .filter((tag) => tag[0] === 'emoji')
    .slice(0, maxEmojiLookup)
    .map((tag) => tag.join('\u0000'))
    .join('\u0001');
  return `${event.id}\u0000${event.content}\u0000${emojiTags}`;
}
