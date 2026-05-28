import { matchesFilter, type NostrFilter } from '$lib/protocol';
import type { OnProgressiveReadSnapshot } from '$lib/relays/progressive-read-types';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { feedEventsFromProgressiveSnapshot } from '$lib/timeline/timeline-progressive';
import { mergeBounds } from '$lib/events/relay-page-filter';
import { readRelayFeedGroups, readRelayFeedPage } from '$lib/events/relay-page';
import type { FeedEvent } from '$lib/events/types';
import type { CustomRequest } from './parse';
import { customRequestMode } from './request-mode';

export type CustomRequestSnapshot = {
  readonly items: readonly FeedEvent[];
  readonly status: Parameters<OnProgressiveReadSnapshot>[0]['status'];
};

export async function readCustomRequestEvents(input: {
  readonly request: CustomRequest;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly onSnapshot?: (snapshot: CustomRequestSnapshot) => void;
}): Promise<FeedEvent[]> {
  const mode = customRequestMode(input.request.filters);
  const key = customRequestKey(
    input.request,
    input.relays,
    input.pageSize,
    mode,
  );
  if (mode === 'exact') {
    const events = await readRelayFeedPage({
      key,
      relays: input.relays,
      filters: input.request.filters,
      pageSize: input.pageSize,
      subscriptions: input.subscriptions,
      purpose: 'feed',
      onSnapshot: input.onSnapshot
        ? (snapshot) =>
            input.onSnapshot?.({
              status: snapshot.status,
              items: filterEvents(
                feedEventsFromProgressiveSnapshot(snapshot),
                input.request.filters,
                input.pageSize,
              ),
            })
        : undefined,
    });
    return filterEvents(events, input.request.filters, input.pageSize);
  }
  const page = await readRelayFeedGroups({
    key,
    groups: [
      {
        key: 'custom-request:selected',
        relays: input.relays,
        authors: [],
        source: 'selected',
      },
    ],
    filters: (_group, bounds) =>
      input.request.filters.map((filter) => mergeBounds(filter, bounds)),
    direction: 'initial',
    before: adaptiveBefore(input.request.filters),
    pageSize: input.pageSize,
    subscriptions: input.subscriptions,
    purpose: 'feed',
  });
  return filterEvents(page.items, input.request.filters, input.pageSize);
}

function adaptiveBefore(filters: readonly NostrFilter[]) {
  const untils = filters.flatMap((filter) =>
    filter.until === undefined ? [] : [filter.until],
  );
  const until = untils.length > 0 ? Math.min(...untils) : undefined;
  return until === undefined
    ? undefined
    : { createdAt: Math.max(0, until - 1), id: 'f'.repeat(64) };
}

function filterEvents(
  events: readonly FeedEvent[],
  filters: readonly NostrFilter[],
  pageSize: number,
): FeedEvent[] {
  return events
    .filter((item) =>
      filters.some((filter) => matchesFilter(item.event, filter)),
    )
    .slice(0, pageSize);
}

export function customRequestKey(
  request: CustomRequest,
  relays: readonly string[],
  pageSize: number,
  mode: string,
): string {
  return JSON.stringify({
    surface: 'custom-request',
    mode,
    pageSize,
    relays: [...relays].sort(),
    filters: request.filters.map(normalizeFilter),
  });
}

function normalizeFilter(filter: NostrFilter): Record<string, unknown> {
  const entries: [string, unknown][] = Object.entries(filter).map(
    ([key, value]) => [key, Array.isArray(value) ? [...value].sort() : value],
  );
  return Object.fromEntries(
    entries.sort(([left], [right]) => left.localeCompare(right)),
  );
}
