import { decodeEntity } from '../protocol/nip19';
import { isEventId, isPubkey } from '../protocol';
import type { ContentAttachment } from './content-media';
import type { ContentToken } from './content-tokens';

export function entityToken(
  raw: string,
  value: string,
): ContentToken | undefined {
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

export function isEmbeddedMedia(attachment: ContentAttachment): boolean {
  return ['image', 'video', 'audio'].includes(attachment.type);
}

export function cleanToken(value: string): string {
  return value.replace(/[),.;:!?]+$/u, '');
}

export function pushText(tokens: ContentToken[], text: string): void {
  if (text.length > 0) tokens.push({ type: 'text', text });
}

export function mergeText(tokens: readonly ContentToken[]): ContentToken[] {
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
