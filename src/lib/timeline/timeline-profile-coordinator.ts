import { hydrateProfiles } from '../identity/profile-hydration';
import type { ProfileSummary } from '../identity/identity';
import { createBoundedMap } from '../fp/bounded-map';
import type { TimelineItem } from './timeline-store';

export type TimelineProfileMap = Record<string, ProfileSummary>;

const negativeTtlMs = 120_000;

export type TimelineProfileCoordinator = ReturnType<
  typeof createTimelineProfileCoordinator
>;

export function createTimelineProfileCoordinator(
  relays: readonly string[],
  subId: string,
) {
  let profiles: TimelineProfileMap = {};
  const misses = createBoundedMap<string, number>({ maxSize: 1000 });
  let requestKey = '';
  const missingAuthors = (items: readonly TimelineItem[]): string[] => {
    const now = Date.now();
    return [...new Set(items.map((item) => item.event.pubkey))]
      .filter((pubkey) => !profiles[pubkey])
      .filter((pubkey) => now - (misses.get(pubkey) ?? 0) > negativeTtlMs);
  };
  const merge = (incoming: TimelineProfileMap): TimelineProfileMap => {
    profiles = monotonicMerge(profiles, incoming);
    return profiles;
  };
  return {
    profiles: (): TimelineProfileMap => profiles,
    merge,
    hydrate: async (
      items: readonly TimelineItem[],
    ): Promise<TimelineProfileMap> => {
      const missing = missingAuthors(items);
      const key = missing.join(',');
      if (missing.length === 0 || key === requestKey) return profiles;
      requestKey = key;
      const loaded = await hydrateProfiles({
        pubkeys: missing,
        relays,
        subId,
      });
      const now = Date.now();
      missing
        .filter((pubkey) => !loaded[pubkey])
        .forEach((pubkey) => misses.set(pubkey, now));
      return merge(loaded);
    },
  };
}

function monotonicMerge(
  current: TimelineProfileMap,
  incoming: TimelineProfileMap,
): TimelineProfileMap {
  let next = current;
  for (const [pubkey, profile] of Object.entries(incoming)) {
    const existing = next[pubkey];
    if (!existing || existing.updatedAt < profile.updatedAt) {
      if (next === current) next = { ...current };
      next[pubkey] = profile;
    }
  }
  return next;
}
