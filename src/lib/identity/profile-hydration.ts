import { loadSettings } from '../settings/settings-store';
import { createBoundedMap } from '../fp/bounded-map';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { sharedSubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import type { ProfileSummary } from './identity';
import { getProfile, profileFromMetadataEvent } from './profile-cache';
import {
  cachedProfileEvent,
  storeProfileEvent,
} from '../profile/profile-store';

export type HydrateProfilesOptions = {
  readonly pubkeys: readonly string[];
  readonly relays: readonly string[];
  readonly owner: string;
  readonly timeoutMs?: number;
  readonly subscriptions?: SubscriptionOrchestrator;
};

type ProfileMap = Record<string, ProfileSummary>;

const inFlight = createBoundedMap<string, Promise<ProfileSummary | undefined>>({
  maxSize: 500,
});

export async function hydrateProfiles({
  pubkeys,
  relays,
  owner,
  timeoutMs = 3500,
  subscriptions = sharedSubscriptionOrchestrator,
}: HydrateProfilesOptions): Promise<ProfileMap> {
  const unique = [...new Set(pubkeys)].filter(Boolean);
  const cached = await cachedProfiles(unique);
  const missing = unique.filter((pubkey) => !cached[pubkey]);
  if (missing.length === 0 || relays.length === 0) return cached;
  if (!(await metadataFetchEnabled())) return cached;

  const pending = missing.filter((pubkey) => !inFlight.get(pubkey));
  if (pending.length > 0) {
    const batch = relayProfileBatch(
      pending,
      relays,
      owner,
      timeoutMs,
      subscriptions,
    );
    for (const pubkey of pending)
      inFlight.set(
        pubkey,
        batch.then((profiles) => profiles[pubkey]),
      );
    void batch.finally(() =>
      pending.forEach((pubkey) => inFlight.delete(pubkey)),
    );
  }

  const loaded = await Promise.all(
    missing.map(
      async (pubkey) => [pubkey, await inFlight.get(pubkey)] as const,
    ),
  );
  return loaded.reduce<ProfileMap>(
    (profiles, [pubkey, profile]) =>
      profile ? { ...profiles, [pubkey]: profile } : profiles,
    cached,
  );
}

async function cachedProfiles(pubkeys: readonly string[]): Promise<ProfileMap> {
  const entries = await Promise.all(
    pubkeys.map(
      async (pubkey) => [pubkey, await cachedProfile(pubkey)] as const,
    ),
  );
  return entries.reduce<ProfileMap>(
    (profiles, [pubkey, profile]) =>
      profile ? { ...profiles, [pubkey]: profile } : profiles,
    {},
  );
}

async function cachedProfile(
  pubkey: string,
): Promise<ProfileSummary | undefined> {
  const cached = getProfile(pubkey);
  if (cached) return cached;
  const event = await cachedProfileEvent(pubkey);
  return event ? profileFromMetadataEvent(event) : undefined;
}

async function relayProfileBatch(
  pubkeys: readonly string[],
  relays: readonly string[],
  owner: string,
  timeoutMs: number,
  subscriptions: SubscriptionOrchestrator,
): Promise<ProfileMap> {
  const { events } = await subscriptions.readPageByIntent(
    {
      surface: 'profile',
      owner,
      phase: 'bootstrap',
      selectedRelays: relays,
      authors: [...pubkeys],
      pageSize: pubkeys.length,
      direction: 'initial',
      purpose: 'metadata',
      relayFilters: [{ kinds: [0], authors: [...pubkeys] }],
    },
    { timeoutMs },
  );
  const profiles: ProfileMap = {};
  for (const { event, relay } of events) {
    const profile = await storeProfileEvent(event, [relay]);
    if (profile) profiles[event.pubkey] = profile;
  }
  return profiles;
}

async function metadataFetchEnabled(): Promise<boolean> {
  const setting = (await loadSettings()).find(
    (item) => item.key === 'profiles.fetchMetadata',
  );
  return setting?.value !== false;
}
