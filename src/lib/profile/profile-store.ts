import { browserDb } from '$lib/storage/browser-db';
import { compareEventsDesc, type NostrEvent } from '$lib/protocol';
import {
  profileFromMetadataEvent,
  setProfile,
} from '$lib/identity/profile-cache';

const memoryEvents = new Map<string, NostrEvent>();

export async function cachedProfileEvent(
  pubkey: string,
): Promise<NostrEvent | undefined> {
  if (typeof indexedDB === 'undefined')
    return [...memoryEvents.values()]
      .filter((event) => event.pubkey === pubkey && event.kind === 0)
      .sort(compareEventsDesc)[0];
  const events = await browserDb()
    .events.where('pubkey')
    .equals(pubkey)
    .toArray()
    .catch(() => []);
  return events.filter((event) => event.kind === 0).sort(compareEventsDesc)[0];
}

export async function cachedProfileNotes(
  pubkey: string,
  limit = 30,
): Promise<NostrEvent[]> {
  if (typeof indexedDB === 'undefined')
    return [...memoryEvents.values()]
      .filter((event) => event.pubkey === pubkey && event.kind === 1)
      .sort(compareEventsDesc)
      .slice(0, limit);
  const events = await browserDb()
    .events.where('pubkey')
    .equals(pubkey)
    .toArray()
    .catch(() => []);
  return events
    .filter((event) => event.kind === 1)
    .sort(compareEventsDesc)
    .slice(0, limit);
}

export async function storeProfileEvent(event: NostrEvent): Promise<void> {
  memoryEvents.set(event.id, event);
  if (event.kind === 0) setProfile(profileFromMetadataEvent(event));
  if (typeof indexedDB === 'undefined') return;
  await browserDb()
    .events.put(event)
    .catch(() => undefined);
}
