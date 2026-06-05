import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { boundaryUntil, readRelayFeedPage } from '$lib/events/relay-page';
import { upsertEvent } from '$lib/events/repository';
import type { FeedCursorPoint, FeedEvent } from '$lib/events/types';
import { compareEventsDesc } from '$lib/protocol';
import { relayMaySupportNip50 } from '$lib/relays/relay-info';
import type { SubscriptionOrchestrator } from '$lib/relays/orchestration/orchestrator';
import { pageIntentSemanticKey } from '$lib/relays/orchestration/page-reads';
import type { OnProgressiveReadSnapshot } from '$lib/relays/progressive-read-types';
import { indexedSearchEvents } from '$lib/storage/repositories/search-index-store';
import { memorySearchEvents } from './search-index-memory';

export type SearchPageRequest = {
  readonly query: string;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly limit: number;
  readonly before?: FeedCursorPoint;
  readonly onSnapshot?: OnProgressiveReadSnapshot;
};

export type SearchDiagnostics = {
  readonly searchedRelays: readonly string[];
  readonly unsupportedRelays: readonly string[];
};

export function searchDiagnosticsText(unsupported: readonly string[]): string {
  if (unsupported.length === 0) return '';
  return `${unsupported.length} selected relay${unsupported.length === 1 ? '' : 's'} did not advertise NIP-50 search.`;
}

export async function searchPage(request: SearchPageRequest): Promise<{
  items: FeedEvent[];
  hasOlder: boolean;
  diagnostics: SearchDiagnostics;
}> {
  const query = request.query.trim();
  if (!query)
    return {
      items: [],
      hasOlder: false,
      diagnostics: { searchedRelays: [], unsupportedRelays: [] },
    };
  const support = await nip50Relays(request.relays);
  const [local, relay] = await Promise.all([
    cachedSearch(query, request.limit, request.before),
    relaySearch(request, query, support.relays),
  ]);
  const merged = mergeItems([...local, ...relay]);
  return {
    items: merged.slice(0, request.limit),
    hasOlder: merged.length > request.limit || relay.length >= request.limit,
    diagnostics: {
      searchedRelays: support.relays,
      unsupportedRelays: support.unsupportedRelays,
    },
  };
}

async function relaySearch(
  request: SearchPageRequest,
  query: string,
  searchRelays: readonly string[],
): Promise<FeedEvent[]> {
  const filters = [
    {
      kinds: feedDisplayKinds,
      search: query,
      limit: request.limit,
      until: boundaryUntil(request.before),
    },
  ];
  const relayItems = await readRelayFeedPage({
    key: pageIntentSemanticKey({
      surface: 'search',
      owner: request.owner,
      phase: request.before ? 'page' : 'bootstrap',
      selectedRelays: searchRelays,
      authors: [],
      pageSize: request.limit,
      direction: request.before ? 'older' : 'initial',
      cursor: request.before,
      purpose: 'search',
      relayFilters: filters,
    }),
    relays: searchRelays,
    filters,
    before: request.before,
    pageSize: request.limit + 1,
    subscriptions: request.subscriptions,
    purpose: 'search',
    onSnapshot: request.onSnapshot,
  });
  await Promise.all(
    relayItems.map((item) => upsertEvent(item.event, item.relays)),
  );
  return relayItems;
}

async function nip50Relays(relays: readonly string[]): Promise<{
  readonly relays: readonly string[];
  readonly unsupportedRelays: readonly string[];
}> {
  const support = await Promise.all(
    relays.map(async (relay) => ({
      relay,
      supported: await relayMaySupportNip50(relay),
    })),
  );
  return {
    relays: support.filter((item) => item.supported).map((item) => item.relay),
    unsupportedRelays: support
      .filter((item) => !item.supported)
      .map((item) => item.relay),
  };
}

async function cachedSearch(
  query: string,
  limit: number,
  before?: FeedCursorPoint,
): Promise<FeedEvent[]> {
  const records =
    (await indexedSearchEvents({
      query,
      limit: limit + 1,
      before,
      kinds: feedDisplayKinds,
    }).catch(() => undefined)) ??
    memorySearchEvents({
      query,
      limit: limit + 1,
      before,
      kinds: feedDisplayKinds,
    });
  return records.map((event) => ({ event, relays: event.relayUrls }));
}

function mergeItems(items: readonly FeedEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const item of items) {
    const existing = byId.get(item.event.id);
    byId.set(item.event.id, existing ? mergeItem(existing, item) : item);
  }
  return [...byId.values()].sort((a, b) => compareEventsDesc(a.event, b.event));
}

function mergeItem(a: FeedEvent, b: FeedEvent): FeedEvent {
  return {
    event: a.event.created_at >= b.event.created_at ? a.event : b.event,
    relays: [...new Set([...a.relays, ...b.relays])],
  };
}
