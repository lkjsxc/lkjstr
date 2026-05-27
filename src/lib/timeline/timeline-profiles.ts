import type { ProfileSummary } from '../identity/identity';
import { profileFromMetadataEvent } from '../identity/profile-cache';
import { hydrateProfiles } from '../identity/profile-hydration';
import type { NostrEvent, NostrFilter } from '../protocol';
import { storeProfileEvent } from '../profile/profile-store';

export type TimelineProfiles = Record<string, ProfileSummary>;

export async function loadTimelineProfiles(
  pubkeys: readonly string[],
  relays: readonly string[] = [],
  owner = 'profiles',
): Promise<TimelineProfiles> {
  return hydrateProfiles({ pubkeys, relays, owner });
}

export async function storeTimelineProfile(
  event: NostrEvent,
): Promise<ProfileSummary> {
  return (await storeProfileEvent(event)) ?? profileFromMetadataEvent(event);
}

export function profileFilter(
  pubkeys: readonly string[],
): readonly NostrFilter[] {
  return pubkeys.length > 0 ? [{ kinds: [0], authors: [...pubkeys] }] : [];
}
