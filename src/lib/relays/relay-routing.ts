import { normalizeRelayUrl } from '../protocol';
import {
  authorRelayRoutes,
  blockedRelayUrls,
  routeAllowed,
} from './relay-route-store';
import type { RelayRouteGroup, RelayRoutePurpose } from './relay-route-types';

export const discoveryRelays = [
  'wss://purplepag.es/',
  'wss://user.kindpag.es/',
  'wss://directory.yabu.me/',
] as const;

const maxRouteRelaysPerAuthor = 4;
const maxRouteGroups = 12;
const maxAuthorsPerRouteGroup = 50;
export const selectedFallbackAuthorLimit = 200;

export async function routedAuthorRelays(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly purpose: RelayRoutePurpose;
  readonly includeDiscovery?: boolean;
}): Promise<string[]> {
  return routeGroups(input).then((groups) => mergeRelays(groups));
}

export async function routeGroups(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly purpose: RelayRoutePurpose;
  readonly includeDiscovery?: boolean;
}): Promise<RelayRouteGroup[]> {
  const blocked = await blockedRelayUrls();
  const selected = normalizeRelays(input.selectedRelays, blocked);
  const routes = await authorRelayRoutes(input.authors);
  const groups = authorGroups(input.authors, routes, input.purpose);
  const discovery = input.includeDiscovery
    ? normalizeRelays(discoveryRelays, blocked)
    : [];
  return [
    ...groups,
    ...(selected.length > 0
      ? fallbackGroups(input.authors, selected, 'fallback')
      : []),
    ...(discovery.length > 0
      ? fallbackGroups(input.authors, discovery, 'discovery')
      : []),
  ].slice(0, maxRouteGroups);
}

export async function routedEventRelays(input: {
  readonly selectedRelays: readonly string[];
  readonly hintedRelays?: readonly string[];
  readonly authorPubkey?: string;
}): Promise<string[]> {
  const blocked = await blockedRelayUrls();
  const hints = normalizeRelays(input.hintedRelays ?? [], blocked);
  const selected = normalizeRelays(input.selectedRelays, blocked);
  const authors = input.authorPubkey ? [input.authorPubkey] : [];
  const routes = await authorRelayRoutes(authors);
  return dedupe([
    ...hints,
    ...routes
      .filter((route) => routeAllowed(route, 'write'))
      .map((route) => route.relayUrl)
      .slice(0, maxRouteRelaysPerAuthor),
    ...selected,
  ]);
}

function authorGroups(
  authors: readonly string[],
  routes: Awaited<ReturnType<typeof authorRelayRoutes>>,
  purpose: RelayRoutePurpose,
): RelayRouteGroup[] {
  return [...new Set(authors)].flatMap((author) => {
    const relays = routes
      .filter((route) => route.authorPubkey === author)
      .filter((route) => routeAllowed(route, purpose))
      .map((route) => route.relayUrl)
      .slice(0, maxRouteRelaysPerAuthor);
    return relays.length
      ? [
          {
            key: `author:${author}`,
            relays,
            authors: [author],
            source: 'nip65',
          },
        ]
      : [];
  });
}

function fallbackGroups(
  authors: readonly string[],
  relays: readonly string[],
  source: RelayRouteGroup['source'],
): RelayRouteGroup[] {
  const groups: RelayRouteGroup[] = [];
  for (let index = 0; index < authors.length; index += maxAuthorsPerRouteGroup)
    groups.push({
      key: `${source}:${index}`,
      relays,
      authors: authors.slice(index, index + maxAuthorsPerRouteGroup),
      source,
    });
  return groups;
}

function mergeRelays(groups: readonly RelayRouteGroup[]): string[] {
  return dedupe(groups.flatMap((group) => group.relays));
}

function normalizeRelays(
  relays: readonly string[],
  blocked: ReadonlySet<string>,
): string[] {
  return dedupe(
    relays
      .map(normalizeRelayUrl)
      .filter((url): url is string => Boolean(url))
      .filter((url) => !blocked.has(url)),
  );
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}
