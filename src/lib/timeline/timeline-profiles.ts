import type { ProfileSummary } from '../identity/identity';
import { profileFromMetadataEvent } from '../identity/profile-cache';
import type { NostrEvent, NostrFilter } from '../protocol';
import {
  cachedProfileEvent,
  storeProfileEvent,
} from '../profile/profile-store';

export type TimelineProfiles = Record<string, ProfileSummary>;

export async function loadTimelineProfiles(
  pubkeys: readonly string[],
): Promise<TimelineProfiles> {
  const entries = await Promise.all(
    pubkeys.map(
      async (pubkey): Promise<[string, ProfileSummary | undefined]> => [
        pubkey,
        await cachedProfile(pubkey),
      ],
    ),
  );
  const profiles: TimelineProfiles = {};
  for (const [pubkey, profile] of entries) {
    if (profile) profiles[pubkey] = profile;
  }
  return profiles;
}

export async function storeTimelineProfile(
  event: NostrEvent,
): Promise<ProfileSummary> {
  await storeProfileEvent(event);
  return profileFromMetadataEvent(event);
}

export function profileFilter(
  pubkeys: readonly string[],
): readonly NostrFilter[] {
  return pubkeys.length > 0 ? [{ kinds: [0], authors: [...pubkeys] }] : [];
}

async function cachedProfile(
  pubkey: string,
): Promise<ProfileSummary | undefined> {
  const event = await cachedProfileEvent(pubkey);
  return event ? profileFromMetadataEvent(event) : undefined;
}
