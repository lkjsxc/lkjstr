import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  indexedDbAvailable,
} from '../storage/safe-storage';
import { createBoundedMap } from '../fp/bounded-map';
import { isPubkey, normalizeRelayUrl } from '../protocol';
import type {
  RelayRoute,
  RelayRouteBlock,
  RelayRoutePurpose,
  RelayRouteSource,
} from './relay-route-types';
import type { RelayPurpose } from './relay-purpose';

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
  purpose: RelayPurpose = 'user',
): Promise<void> {
  const normalized = normalizeRelayUrl(relayUrl);
  if (!normalized) return;
  const id = routeBlockId(normalized, purpose);
  const block = {
    relayUrl: id,
    url: normalized,
    purpose,
    reason,
    updatedAt: Date.now(),
  };
  memoryBlocks.set(id, block);
  await bestEffortStorageWrite(() => browserDb().relayRouteBlocks.put(block));
}

export async function clearRouteBlock(
  relayUrl: string,
  purpose: RelayPurpose = 'user',
): Promise<void> {
  const normalized = normalizeRelayUrl(relayUrl);
  if (!normalized) return;
  const id = routeBlockId(normalized, purpose);
  memoryBlocks.delete(id);
  await bestEffortStorageWrite(() => browserDb().relayRouteBlocks.delete(id));
}

export async function blockedRelayUrls(
  purpose: RelayPurpose = 'user',
): Promise<Set<string>> {
  const rows = await boundedStorageRead(
    () =>
      browserDb()
        .relayRouteBlocks.orderBy('updatedAt')
        .reverse()
        .limit(500)
        .toArray(),
    [...memoryBlocks.values()],
  );
  return new Set(
    rows
      .filter((row) => (row.purpose ?? 'user') === purpose)
      .map((row) => row.url ?? row.relayUrl),
  );
}

export async function authorRelayRoutes(
  authors: readonly string[],
  blockPurpose: RelayPurpose = 'user',
): Promise<RelayRoute[]> {
  const wanted = new Set(authors.filter(isPubkey));
  if (wanted.size === 0) return [];
  const rows = await boundedStorageRead(
    () => indexedAuthorRoutes([...wanted]),
    [...memoryRoutes.values()],
  );
  const blocked = await blockedRelayUrls(blockPurpose);
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

function routeBlockId(relayUrl: string, purpose: RelayPurpose): string {
  return `${purpose}:${relayUrl}`;
}
