import {
  normalizeRelayUrl,
  type NostrEvent,
  type NostrTag,
} from '$lib/protocol';
import type { PublicChatMetadata } from './public-chat-types';

const maxNameBytes = 128;
const maxAboutBytes = 1024;
const maxPictureBytes = 2048;

export function emptyPublicChatMetadata(): PublicChatMetadata {
  return { relays: [] };
}

export function parsePublicChatMetadata(content: string): PublicChatMetadata {
  const raw = content.trim() === '' ? {} : JSON.parse(content);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Channel metadata must be an object.');
  const record = raw as Record<string, unknown>;
  return {
    name: boundedText(record.name, maxNameBytes),
    about: boundedText(record.about, maxAboutBytes),
    picture: httpsPicture(record.picture),
    relays: relayList(record.relays),
  };
}

export function channelRootEventId(event: NostrEvent): string | undefined {
  return markedEventTag(event.tags, 'root') ?? firstTagValue(event.tags, 'e');
}

export function channelReplyEventId(event: NostrEvent): string | undefined {
  return markedEventTag(event.tags, 'reply') ?? lastNonRootEvent(event.tags);
}

export function channelRootTag(
  channelId: string,
  relayHint?: string,
): readonly string[] {
  return ['e', channelId, relayHint ?? '', 'root'];
}

export function channelReplyTags(
  channelId: string,
  rootMessageId: string,
  replyMessageId: string,
  relayHint?: string,
): readonly NostrTag[] {
  const tags: NostrTag[] = [channelRootTag(channelId, relayHint)];
  if (rootMessageId) tags.push(['e', rootMessageId, relayHint ?? '', 'root']);
  if (replyMessageId && replyMessageId !== rootMessageId)
    tags.push(['e', replyMessageId, relayHint ?? '', 'reply']);
  return tags;
}

export function hideMessageTarget(event: NostrEvent): string | undefined {
  return firstTagValue(event.tags, 'e');
}

export function muteUserTarget(event: NostrEvent): string | undefined {
  return firstTagValue(event.tags, 'p');
}

function boundedText(value: unknown, maxBytes: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string')
    throw new Error('Metadata field must be text.');
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (new TextEncoder().encode(trimmed).length > maxBytes)
    throw new Error('Metadata field is too long.');
  return trimmed;
}

function httpsPicture(value: unknown): string | undefined {
  const text = boundedText(value, maxPictureBytes);
  if (!text) return undefined;
  try {
    return new URL(text).protocol === 'https:' ? text : undefined;
  } catch {
    return undefined;
  }
}

function relayList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const relays: string[] = [];
  for (const item of value) {
    const url = typeof item === 'string' ? normalizeRelayUrl(item) : undefined;
    if (url && !relays.includes(url)) relays.push(url);
  }
  return relays;
}

function firstTagValue(
  tags: readonly NostrTag[],
  name: string,
): string | undefined {
  return tags.find((tag) => tag[0] === name)?.[1];
}

function markedEventTag(
  tags: readonly NostrTag[],
  marker: string,
): string | undefined {
  return tags.find((tag) => tag[0] === 'e' && tag[3] === marker)?.[1];
}

function lastNonRootEvent(tags: readonly NostrTag[]): string | undefined {
  const root = markedEventTag(tags, 'root');
  return [...tags]
    .reverse()
    .find((tag) => tag[0] === 'e' && tag[1] && tag[1] !== root)?.[1];
}
