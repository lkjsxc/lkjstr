import type { StoredEvent } from './types';

export function normalizeStoredEvent(event: Partial<StoredEvent>): StoredEvent {
  const relayUrls =
    event.relayUrls && event.relayUrls.length > 0
      ? [...event.relayUrls]
      : ['cache'];
  return {
    id: event.id ?? '',
    pubkey: event.pubkey ?? '',
    created_at: event.created_at ?? 0,
    kind: event.kind ?? 1,
    tags: event.tags ?? [],
    content: event.content ?? '',
    sig: event.sig ?? '',
    receivedAt: event.receivedAt ?? 0,
    relayUrls,
  };
}
