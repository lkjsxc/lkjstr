import { compareEventsDesc, type NostrEvent } from '$lib/protocol';
import { queryFeed, upsertEvent } from '$lib/events/repository';
import {
  boundedStorageRead,
  indexedDbAvailable,
} from '$lib/storage/safe-storage';
import {
  profileFromMetadataEvent,
  setProfile,
} from '$lib/identity/profile-cache';

const memoryEvents = new Map<string, NostrEvent>();

export async function cachedProfileEvent(
  pubkey: string,
): Promise<NostrEvent | undefined> {
  if (!indexedDbAvailable())
    return [...memoryEvents.values()]
      .filter((event) => event.pubkey === pubkey && event.kind === 0)
      .sort(compareEventsDesc)[0];
  const { browserDb } = await import('$lib/storage/browser-db');
  const events = await boundedStorageRead(
    () => browserDb().events.where('pubkey').equals(pubkey).toArray(),
    [...memoryEvents.values()],
  );
  return events.filter((event) => event.kind === 0).sort(compareEventsDesc)[0];
}

export async function cachedProfileNotes(
  pubkey: string,
  limit = 30,
): Promise<NostrEvent[]> {
  if (!indexedDbAvailable())
    return [...memoryEvents.values()]
      .filter((event) => event.pubkey === pubkey && event.kind === 1)
      .sort(compareEventsDesc)
      .slice(0, limit);
  return (
    await queryFeed({ kind: 'profile', authors: [pubkey], limit })
  ).items.map((item) => item.event);
}

export async function storeProfileEvent(
  event: NostrEvent,
  relays: readonly string[] = [],
): Promise<void> {
  memoryEvents.set(event.id, event);
  if (event.kind === 0) setProfile(profileFromMetadataEvent(event));
  await upsertEvent(event, relays);
}
