import { browserDb } from '$lib/storage/browser-db';
import { compareEventsDesc, type NostrEvent } from '$lib/protocol';
import {
  profileFromMetadataEvent,
  setProfile,
} from '$lib/identity/profile-cache';

export async function cachedProfileEvent(
  pubkey: string,
): Promise<NostrEvent | undefined> {
  const events = await browserDb()
    .events.where('pubkey')
    .equals(pubkey)
    .toArray()
    .catch(() => []);
  return events.filter((event) => event.kind === 0).sort(compareEventsDesc)[0];
}

export async function cachedProfilePosts(
  pubkey: string,
  limit = 30,
): Promise<NostrEvent[]> {
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
  if (event.kind === 0) setProfile(profileFromMetadataEvent(event));
  await browserDb()
    .events.put(event)
    .catch(() => undefined);
}
