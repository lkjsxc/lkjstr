import type { NostrEvent } from '$lib/protocol';
import {
  latestEventByAuthorKind,
  queryFeed,
  upsertEvent,
} from '$lib/events/repository';
import {
  getProfile,
  profileFromMetadataEvent,
  setProfile,
} from '$lib/identity/profile-cache';
import type { ProfileSummary } from '$lib/identity/identity';
import type { FeedEvent } from '$lib/events/types';
import { feedEventsInDisplayBounds } from '$lib/events/feed-display-bounds';

export async function cachedProfileEvent(
  pubkey: string,
): Promise<NostrEvent | undefined> {
  const profile = getProfile(pubkey);
  const event = (await latestEventByAuthorKind(pubkey, 0))?.event;
  if (profile && event && profile.updatedAt > event.created_at * 1000)
    return undefined;
  return event;
}

export async function cachedProfileNotes(
  pubkey: string,
  limit = 30,
): Promise<FeedEvent[]> {
  return feedEventsInDisplayBounds([
    ...(await queryFeed({ kind: 'profile', authors: [pubkey], limit })).items,
  ]);
}

export async function cachedProfileFollowList(
  pubkey: string,
): Promise<NostrEvent | undefined> {
  return (await latestEventByAuthorKind(pubkey, 3))?.event;
}

export async function storeProfileEvent(
  event: NostrEvent,
  relays: readonly string[] = [],
): Promise<ProfileSummary | undefined> {
  let profile: ProfileSummary | undefined;
  if (event.kind === 0) {
    profile = setProfile(profileFromMetadataEvent(event));
  }
  await upsertEvent(event, relays);
  return profile;
}
