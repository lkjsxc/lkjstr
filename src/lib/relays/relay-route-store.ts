import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  indexedDbAvailable,
} from '../storage/safe-storage';
import { createBoundedMap } from '../fp/bounded-map';
import {
  isPubkey,
  kinds,
  normalizeRelayUrl,
  type NostrEvent,
} from '../protocol';
import type {
  RelayRoute,
  RelayRouteBlock,
  RelayRoutePurpose,
  RelayRouteSource,
} from './relay-route-types';

const memoryRoutes = createBoundedMap<string, RelayRoute>({ maxSize: 2000 });
const memoryBlocks = createBoundedMap<string, RelayRouteBlock>({
  maxSize: 250,
});

export async function saveAuthorRelayRoute(
  input: Omit<RelayRoute, 'id' | 'updatedAt'>,
): Promise<void> {
  await saveAuthorRelayRoutes([input]);
}

export async function saveAuthorRelayRoutes(
  inputs: readonly Omit<RelayRoute, 'id' | 'updatedAt'>[],
): Promise<void> {
  const routes: RelayRoute[] = [];
  for (const input of inputs) {
    const relayUrl = normalizeRelayUrl(input.relayUrl);
    if (!relayUrl || !isPubkey(input.authorPubkey)) continue;
    const route = {
      ...input,
      relayUrl,
      id: routeId(input.authorPubkey, relayUrl, input.source),
      updatedAt: Date.now(),
    };
    memoryRoutes.set(route.id, route);
    routes.push(route);
  }
  if (routes.length === 0) return;
  await bestEffortStorageWrite(() =>
    browserDb().authorRelayRoutes.bulkPut(routes),
  );
}

export async function saveRouteBlock(
  relayUrl: string,
  reason: RelayRouteBlock['reason'],
): Promise<void> {
  const normalized = normalizeRelayUrl(relayUrl);
  if (!normalized) return;
  const block = { relayUrl: normalized, reason, updatedAt: Date.now() };
  memoryBlocks.set(normalized, block);
  await bestEffortStorageWrite(() => browserDb().relayRouteBlocks.put(block));
}

export async function clearRouteBlock(relayUrl: string): Promise<void> {
  const normalized = normalizeRelayUrl(relayUrl);
  if (!normalized) return;
  memoryBlocks.delete(normalized);
  await bestEffortStorageWrite(() =>
    browserDb().relayRouteBlocks.delete(normalized),
  );
}

export async function blockedRelayUrls(): Promise<Set<string>> {
  const rows = await boundedStorageRead(
    () =>
      browserDb().relayRouteBlocks.orderBy('updatedAt').reverse().limit(500).toArray(),
    [...memoryBlocks.values()],
  );
  return new Set(rows.map((row) => row.relayUrl));
}

export async function authorRelayRoutes(
  authors: readonly string[],
): Promise<RelayRoute[]> {
  const wanted = new Set(authors.filter(isPubkey));
  if (wanted.size === 0) return [];
  const rows = await boundedStorageRead(
    () => indexedAuthorRoutes([...wanted]),
    [...memoryRoutes.values()],
  );
  const blocked = await blockedRelayUrls();
  return rows
    .filter((row) => wanted.has(row.authorPubkey))
    .filter((row) => !blocked.has(row.relayUrl))
    .sort((a, b) => routeScore(b) - routeScore(a) || b.updatedAt - a.updatedAt);
}

async function indexedAuthorRoutes(authors: readonly string[]) {
  if (!indexedDbAvailable()) return [...memoryRoutes.values()];
  return browserDb()
    .authorRelayRoutes.where('authorPubkey')
    .anyOf(authors)
    .toArray();
}

export async function storeRoutesFromEvent(
  event: NostrEvent,
  relayUrls: readonly string[],
): Promise<void> {
  const inputs: Omit<RelayRoute, 'id' | 'updatedAt'>[] = [];
  if (event.kind === kinds.relayListMetadata)
    inputs.push(...nip65RouteInputs(event));
  if (event.kind === kinds.followList) inputs.push(...nip02RouteInputs(event));
  inputs.push(...receiptRouteInputs(event, relayUrls));
  await saveAuthorRelayRoutes(inputs);
}

export function clearRelayRoutesForTests(): void {
  memoryRoutes.clear();
  memoryBlocks.clear();
}

export function routeAllowed(
  route: RelayRoute,
  purpose: RelayRoutePurpose,
): boolean {
  return route.purpose === purpose || route.purpose === 'both';
}

function nip65RouteInputs(
  event: NostrEvent,
): Omit<RelayRoute, 'id' | 'updatedAt'>[] {
  return event.tags
    .filter((tag) => tag[0] === 'r' && tag[1])
    .map((tag) => ({
      authorPubkey: event.pubkey,
      relayUrl: tag[1],
      source: 'nip65' as const,
      purpose: nip65Purpose(tag[2]),
      eventId: event.id,
    }));
}

function nip02RouteInputs(
  event: NostrEvent,
): Omit<RelayRoute, 'id' | 'updatedAt'>[] {
  return event.tags
    .filter((tag) => tag[0] === 'p' && tag[1] && tag[2])
    .map((tag) => ({
      authorPubkey: tag[1],
      relayUrl: tag[2],
      source: 'nip02' as const,
      purpose: 'write' as const,
      eventId: event.id,
    }));
}

function receiptRouteInputs(
  event: NostrEvent,
  relayUrls: readonly string[],
): Omit<RelayRoute, 'id' | 'updatedAt'>[] {
  return relayUrls.map((relayUrl) => ({
    authorPubkey: event.pubkey,
    relayUrl,
    source: 'event-receipt' as const,
    purpose: 'write' as const,
    eventId: event.id,
  }));
}

function nip65Purpose(marker: string | undefined): RelayRoutePurpose {
  if (marker === 'read') return 'read';
  if (marker === 'write') return 'write';
  return 'both';
}

function routeScore(route: RelayRoute): number {
  const scores: Record<RelayRouteSource, number> = {
    selected: 1,
    discovery: 2,
    nip02: 3,
    nip65: 4,
    'event-receipt': 5,
    'event-hint': 6,
  };
  return scores[route.source];
}

function routeId(
  authorPubkey: string,
  relayUrl: string,
  source: RelayRouteSource,
): string {
  return `${authorPubkey}:${relayUrl}:${source}`;
}
