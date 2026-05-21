import { hydrateProfiles } from '../identity/profile-hydration';
import type { ProfileSummary } from '../identity/identity';
import type { TimelineItem } from './timeline-store';

export type TimelineProfileMap = Record<string, ProfileSummary>;

const negativeTtlMs = 120_000;

export class TimelineProfileCoordinator {
  #profiles: TimelineProfileMap = {};
  #misses = new Map<string, number>();
  #requestKey = '';

  constructor(
    readonly relays: readonly string[],
    readonly subId: string,
  ) {}

  profiles(): TimelineProfileMap {
    return this.#profiles;
  }

  merge(profiles: TimelineProfileMap): TimelineProfileMap {
    this.#profiles = monotonicMerge(this.#profiles, profiles);
    return this.#profiles;
  }

  async hydrate(items: readonly TimelineItem[]): Promise<TimelineProfileMap> {
    const missing = this.#missingAuthors(items);
    const key = missing.join(',');
    if (missing.length === 0 || key === this.#requestKey) return this.#profiles;
    this.#requestKey = key;
    const loaded = await hydrateProfiles({
      pubkeys: missing,
      relays: this.relays,
      subId: this.subId,
    });
    const now = Date.now();
    missing
      .filter((pubkey) => !loaded[pubkey])
      .forEach((pubkey) => this.#misses.set(pubkey, now));
    return this.merge(loaded);
  }

  #missingAuthors(items: readonly TimelineItem[]): string[] {
    const now = Date.now();
    return [...new Set(items.map((item) => item.event.pubkey))]
      .filter((pubkey) => !this.#profiles[pubkey])
      .filter(
        (pubkey) => now - (this.#misses.get(pubkey) ?? 0) > negativeTtlMs,
      );
  }
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
