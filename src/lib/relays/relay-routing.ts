import { countRuntime } from '../app/runtime-counters';
import {
  authorRelayRoutes,
  blockedRelayUrls,
  routeAllowed,
} from './relay-route-store';
import { listRelaySets } from './relay-store';
import { enabledDiscoveryRelays } from './relay-selection';
import type { RelayRouteGroup, RelayRoutePurpose } from './relay-route-types';
import {
  dedupe,
  fallbackGroups,
  mergeRelays,
  normalizeRelays,
} from './relay-routing-groups';

const maxRouteRelaysPerAuthor = 4;
const maxRouteGroups = 12;
export const selectedFallbackAuthorLimit = 200;

export async function routedAuthorRelays(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly purpose: RelayRoutePurpose;
  readonly includeDiscovery?: boolean;
  readonly allowDiscoveryOnly?: boolean;
}): Promise<string[]> {
  return routeGroups(input).then((groups) => mergeRelays(groups));
}

export async function routeGroups(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly purpose: RelayRoutePurpose;
  readonly includeDiscovery?: boolean;
  readonly allowDiscoveryOnly?: boolean;
}): Promise<RelayRouteGroup[]> {
  const userBlocked = await blockedRelayUrls('user');
  const selected = normalizeRelays(input.selectedRelays, userBlocked);
  const routes = await authorRelayRoutes(input.authors, 'user');
  const discoveryOnly = input.allowDiscoveryOnly
    ? new Set<string>()
    : await discoveryOnlyRelays(selected);
  const groups = authorGroups(
    input.authors,
    routes.filter((route) => !discoveryOnly.has(route.relayUrl)),
    input.purpose,
  ).slice(0, maxRouteGroups);
  const discovery = input.includeDiscovery
    ? normalizeRelays(
        await configuredDiscoveryRelays(),
        await blockedRelayUrls('discovery'),
      )
    : [];
  const selectedGroups =
    selected.length > 0
      ? fallbackGroups(
          input.authors,
          selected,
          'fallback',
          selectedFallbackAuthorLimit,
        )
      : [];
  for (let index = 0; index < groups.length; index += 1)
    countRuntime('timeline', 'targetedGroups');
  for (let index = 0; index < selectedGroups.length; index += 1)
    countRuntime('timeline', 'selectedFallbackGroups');
  return [
    ...groups,
    ...selectedGroups,
    ...(discovery.length > 0
      ? fallbackGroups(
          input.authors,
          discovery,
          'discovery',
          selectedFallbackAuthorLimit,
        )
      : []),
  ];
}

export async function routeGroupsForPaging(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly purpose: RelayRoutePurpose;
}): Promise<RelayRouteGroup[]> {
  const blocked = await blockedRelayUrls('user');
  const selected = normalizeRelays(input.selectedRelays, blocked);
  const discoveryOnly = await discoveryOnlyRelays(selected);
  const routes = (await authorRelayRoutes(input.authors, 'user')).filter(
    (route) => !discoveryOnly.has(route.relayUrl),
  );
  const groups = authorGroups(input.authors, routes, input.purpose).slice(
    0,
    maxRouteGroups,
  );
  for (let index = 0; index < groups.length; index += 1)
    countRuntime('timeline', 'targetedGroups');
  if (groups.length > 0) return groups;
  if (selected.length === 0) return [];
  for (let index = 0; index < 1; index += 1)
    countRuntime('timeline', 'selectedFallbackGroups');
  return fallbackGroups(
    input.authors,
    selected,
    'fallback',
    selectedFallbackAuthorLimit,
  );
}

export async function routedEventRelays(input: {
  readonly selectedRelays: readonly string[];
  readonly hintedRelays?: readonly string[];
  readonly authorPubkey?: string;
}): Promise<string[]> {
  const blocked = await blockedRelayUrls('user');
  const hints = normalizeRelays(input.hintedRelays ?? [], blocked);
  const selected = normalizeRelays(input.selectedRelays, blocked);
  const discoveryOnly = await discoveryOnlyRelays(selected);
  const authors = input.authorPubkey ? [input.authorPubkey] : [];
  const routes = await authorRelayRoutes(authors, 'user');
  return dedupe([
    ...hints.filter((relay) => !discoveryOnly.has(relay)),
    ...routes
      .filter((route) => routeAllowed(route, 'write'))
      .filter((route) => !discoveryOnly.has(route.relayUrl))
      .map((route) => route.relayUrl)
      .slice(0, maxRouteRelaysPerAuthor),
    ...selected,
  ]);
}

export async function configuredDiscoveryRelays(): Promise<string[]> {
  return enabledDiscoveryRelays(await listRelaySets());
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

async function discoveryOnlyRelays(
  selectedRelays: readonly string[],
): Promise<Set<string>> {
  const selected = new Set(selectedRelays);
  return new Set(
    (await configuredDiscoveryRelays()).filter((relay) => !selected.has(relay)),
  );
}
