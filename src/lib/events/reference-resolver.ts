import { lookupEvents, upsertEvent } from './repository';
import { readRelayPage } from './relay-page';
import type { FeedEvent } from './types';
import type { EventReference } from '../protocol';
import type { RelaySubscriptionManager } from '../relays/subscription-manager';
import { sharedSubscriptionManager } from '../relays/subscription-manager';

export type ResolvedReference = EventReference & {
  readonly event?: FeedEvent;
};

const cache = new Map<string, FeedEvent | undefined>();

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
  for (const id of ids) {
    const key = cacheKey(id, relays);
    if (cache.has(key)) byId.set(id, cache.get(key));
  }
  const uncached = ids.filter((id) => !byId.has(id));
  const cached = await lookupEvents(uncached);
  cached.forEach((item) => byId.set(item.event.id, item));
  const missing = ids.filter((id) => !byId.get(id));
  if (missing.length > 0 && relays.length > 0) {
    const hits = await readRelayPage({
      key: input.key,
      relays,
      filters: [{ ids: missing }],
      pageSize: missing.length,
      subscriptions: input.subscriptions ?? sharedSubscriptionManager,
    });
    await Promise.all(hits.map((hit) => upsertEvent(hit.event, [hit.relay])));
    hits.forEach((hit) =>
      byId.set(hit.event.id, { event: hit.event, relays: [hit.relay] }),
    );
  }
  for (const id of ids) cache.set(cacheKey(id, relays), byId.get(id));
  return input.references.map((reference) => ({
    ...reference,
    event: byId.get(reference.id),
  }));
}

function cacheKey(id: string, relays: readonly string[]): string {
  return `${id}|${[...relays].sort().join('\u0000')}`;
}
