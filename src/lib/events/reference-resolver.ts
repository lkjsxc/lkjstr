import { lookupEvents, upsertEvent } from './repository';
import { readRelayPage } from './relay-page';
import type { FeedEvent } from './types';
import type { EventReference } from '../protocol';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import { sharedSubscriptionManager } from '../relays/subscription-manager';

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
  const relays = [
    ...new Set([
      ...input.references.flatMap((item) => item.relays ?? []),
      ...input.relays,
    ]),
  ];
  const ids = [...new Set(input.references.map((item) => item.id))];
  const byId = new Map<string, FeedEvent | undefined>();
  const now = Date.now();
  for (const id of ids) {
    const key = cacheKey(id, relays);
    const entry = cache.get(key);
    if (entry && entry.expiresAt > now) byId.set(id, entry.value);
    else if (entry) cache.delete(key);
  }
  const uncached = ids.filter((id) => !byId.has(id));
  const cached = await lookupEvents(uncached);
  cached.forEach((item) => byId.set(item.event.id, item));
  const missing = ids.filter((id) => !byId.get(id));
  if (missing.length > 0 && relays.length > 0) {
    const flightKey = cacheKey(missing.join(','), relays);
    const hits =
      inFlight.get(flightKey) ??
      readRelayPage({
        key: input.key,
        relays,
        filters: [{ ids: missing }],
        pageSize: missing.length,
        subscriptions: input.subscriptions ?? sharedSubscriptionManager,
      }).then(async (hits) => {
        await Promise.all(
          hits.map((hit) => upsertEvent(hit.event, [hit.relay])),
        );
        return hits.map((hit) => ({
          event: hit.event,
          relays: [hit.relay],
        }));
      });
    inFlight.set(flightKey, hits);
    try {
      (await hits).forEach((item) => byId.set(item.event.id, item));
    } finally {
      inFlight.delete(flightKey);
    }
  }
  for (const id of ids)
    cache.set(cacheKey(id, relays), {
      value: byId.get(id),
      expiresAt: Date.now() + cacheTtlMs,
    });
  return input.references.map((reference) => ({
    ...reference,
    event: byId.get(reference.id),
  }));
}

function cacheKey(id: string, relays: readonly string[]): string {
  return `${id}|${[...relays].sort().join('\u0000')}`;
}
