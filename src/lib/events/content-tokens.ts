import { decodeEntity } from '../protocol/nip19';
import {
  customEmojis,
  isEventId,
  isPubkey,
  type CustomEmoji,
  type NostrEvent,
} from '../protocol';
import { bestDisplayName } from '../identity/display-name';
import type { ProfileSummary } from '../identity/identity';
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

export function contentTokens(
  event: NostrEvent,
  profiles: Record<string, ProfileSummary> = {},
  hiddenEventIds: ReadonlySet<string> = new Set(),
): ContentToken[] {
  const hiddenUrls = new Set(
    contentAttachments(event)
      .filter(isEmbeddedMedia)
      .map((attachment) => attachment.url),
  );
  return tokenizeText(
    event.content,
    hiddenUrls,
    customEmojis(event),
    profiles,
    hiddenEventIds,
  );
}

export function tokenizeText(
  content: string,
  hiddenUrls: ReadonlySet<string> = new Set(),
  emoji: readonly CustomEmoji[] = [],
  profiles: Record<string, ProfileSummary> = {},
  hiddenEventIds: ReadonlySet<string> = new Set(),
): ContentToken[] {
  const tokens: ContentToken[] = [];
  const emojiByText = new Map(
    emoji.map((item) => [`:${item.shortcode}:`, item]),
  );
  let index = 0;
  for (const match of content.matchAll(tokenPattern)) {
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
      const token = entityToken(raw, entity, profiles);
      if (token?.type === 'event' && hiddenEventIds.has(token.eventId)) {
        pushText(tokens, suffix);
        continue;
      }
      tokens.push(token ?? { type: 'text', text: raw });
      pushText(tokens, suffix);
      continue;
    }
    if (!hiddenUrls.has(raw)) tokens.push({ type: 'url', url: raw, text: raw });
    pushText(tokens, suffix);
  }
  if (index < content.length) pushText(tokens, content.slice(index));
  return mergeText(tokens);
}

function entityToken(
  raw: string,
  value: string,
  profiles: Record<string, ProfileSummary>,
): ContentToken | undefined {
  const decoded = decodeEntity(value);
  if (!decoded) return undefined;
  if (decoded.type === 'npub' && isPubkey(decoded.data))
    return profileToken(raw, decoded.data, [], profiles);
  if (decoded.type === 'nprofile' && isPubkey(decoded.data.pubkey))
    return profileToken(
      raw,
      decoded.data.pubkey,
      decoded.data.relays ?? [],
      profiles,
    );
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
  profiles: Record<string, ProfileSummary>,
): ContentToken {
  const profile = profiles[pubkey];
  const label = profile ? `@${bestDisplayName(profile)}` : raw;
  return { type: 'profile', pubkey, text: label, rawText: raw, relays };
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
