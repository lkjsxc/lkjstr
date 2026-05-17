import { getEventHash } from 'nostr-tools/pure';
import type { UnsignedNostrEvent } from './event';

export function serializeEvent(event: UnsignedNostrEvent): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

export function computeEventId(event: UnsignedNostrEvent): string {
  return getEventHash({
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags.map((tag) => [...tag]),
    content: event.content,
  });
}
