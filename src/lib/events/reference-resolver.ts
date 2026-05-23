import { lookupEvents, upsertEvent } from './repository';
import { readRelayFeedPage } from './relay-page';
import type { FeedEvent } from './types';
import type { EventReference } from '../protocol';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import { sharedSubscriptionManager } from '../relays/subscription-manager';
import { routedEventRelays } from '../relays/relay-routing';

export type ResolvedReference = EventReference & {
  readonly event?: FeedEvent;
};

type CacheEntry = {
  readonly value: FeedEvent | undefined;
  readonly expiresAt: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<readonly FeedEvent[]>>();
const cacheTtlMs = 5 * 60 * 1000;

export async function resolveReferences(input: {
  readonly references: readonly EventReference[];
  readonly relays: readonly string[];
  readonly key: string;
  readonly subscriptions?: RelaySubscriptionManager;
}): Promise<ResolvedReference[]> {
  const ids = [...new Set(input.references.map((item) => item.id))];
  const byId = new Map<string, FeedEvent | undefined>();
  const now = Date.now();
  for (const id of ids) {
    const relays = await referenceRelays(input, id);
    const key = cacheKey(id, relays);
    const entry = cache.get(key);
    if (entry && entry.expiresAt > now) byId.set(id, entry.value);
    else if (entry) cache.delete(key);
  }
  const uncached = ids.filter((id) => !byId.has(id));
  const cached = await lookupEvents(uncached);
  cached.forEach((item) => byId.set(item.event.id, item));
  const missing = ids.filter((id) => !byId.get(id));
  const groups = await referenceGroups(input, missing);
  await Promise.all(
    [...groups].map(([key, group]) => readGroup(input, key, group, byId)),
  );
  for (const id of ids) {
    const relays = await referenceRelays(input, id);
    cache.set(cacheKey(id, relays), {
      value: byId.get(id),
      expiresAt: Date.now() + cacheTtlMs,
    });
  }
  return input.references.map((reference) => ({
    ...reference,
    event: byId.get(reference.id),
  }));
}

function cacheKey(id: string, relays: readonly string[]): string {
  return `${id}|${[...relays].sort().join('\u0000')}`;
}

async function referenceRelays(
  input: Parameters<typeof resolveReferences>[0],
  id: string,
): Promise<string[]> {
  const refs = input.references.filter((item) => item.id === id);
  return routedEventRelays({
    selectedRelays: input.relays,
    hintedRelays: refs.flatMap((item) => item.relays ?? []),
    authorPubkey: refs.find((item) => item.authorPubkey)?.authorPubkey,
  });
}

async function referenceGroups(
  input: Parameters<typeof resolveReferences>[0],
  ids: readonly string[],
): Promise<Map<string, { ids: string[]; relays: string[] }>> {
  const groups = new Map<string, { ids: string[]; relays: string[] }>();
  for (const id of ids) {
    const relays = await referenceRelays(input, id);
    if (relays.length === 0) continue;
    const key = cacheKey('group', relays);
    const group = groups.get(key) ?? { ids: [], relays };
    group.ids.push(id);
    groups.set(key, group);
  }
  return groups;
}

async function readGroup(
  input: Parameters<typeof resolveReferences>[0],
  key: string,
  group: { ids: string[]; relays: string[] },
  byId: Map<string, FeedEvent | undefined>,
): Promise<void> {
  const hits =
    inFlight.get(key) ??
    readRelayFeedPage({
      key: input.key,
      relays: group.relays,
      filters: [{ ids: group.ids, limit: group.ids.length }],
      pageSize: group.ids.length,
      subscriptions: input.subscriptions ?? sharedSubscriptionManager,
      purpose: 'event-lookup',
    }).then(async (hits) => {
      await Promise.all(hits.map((hit) => upsertEvent(hit.event, hit.relays)));
      return hits;
    });
  inFlight.set(key, hits);
  try {
    (await hits).forEach((item) => byId.set(item.event.id, item));
  } finally {
    inFlight.delete(key);
  }
}
