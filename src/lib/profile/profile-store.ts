import { compareEventsDesc, type NostrEvent } from '$lib/protocol';
import {
  latestEventByAuthorKind,
  queryFeed,
  upsertEvent,
} from '$lib/events/repository';
import { indexedDbAvailable } from '$lib/storage/safe-storage';
import {
  getProfile,
  profileFromMetadataEvent,
  setProfile,
} from '$lib/identity/profile-cache';

const memoryEvents = new Map<string, NostrEvent>();

export async function cachedProfileEvent(
  pubkey: string,
): Promise<NostrEvent | undefined> {
  const profile = getProfile(pubkey);
  if (!indexedDbAvailable())
    return [...memoryEvents.values()]
      .filter((event) => event.pubkey === pubkey && event.kind === 0)
      .sort(compareEventsDesc)[0];
  const event = (await latestEventByAuthorKind(pubkey, 0))?.event;
  if (profile && event && profile.updatedAt > event.created_at * 1000)
    return undefined;
  return event;
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
  if (event.kind === 0) {
    const existing = getProfile(event.pubkey);
    if (!existing || existing.updatedAt <= event.created_at * 1000)
      setProfile(profileFromMetadataEvent(event));
  }
  await upsertEvent(event, relays);
}
