import { discoverAuthorRelayRoutes } from '../relay-discovery';
import { routeGroupsForPaging, routedAuthorRelays } from '../relay-routing';
import type { RelayRoutePurpose } from '../relay-route-types';
import type { RelayRouteGroup } from '../relay-route-types';
import { relaysForSurfaceDemand } from './surface-routing';
import type { DemandSurface } from './demand-types';

export async function planAuthorReadRelays(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
}): Promise<string[]> {
  return routedAuthorRelays({
    authors: input.authors,
    selectedRelays: input.selectedRelays,
    purpose: 'read',
  });
}

export async function planAuthorWriteRelays(input: {
  readonly surface: DemandSurface;
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
}): Promise<string[]> {
  const routed = await routedAuthorRelays({
    authors: input.authors,
    selectedRelays: input.selectedRelays,
    purpose: 'write',
  });
  return relaysForSurfaceDemand({
    surface: input.surface,
    selectedReadRelays: routed.length > 0 ? routed : input.selectedRelays,
  });
}

export async function planPagingRouteGroups(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly purpose: RelayRoutePurpose;
}): Promise<readonly RelayRouteGroup[]> {
  return routeGroupsForPaging(input);
}

export function discoverRoutesForAuthors(input: {
  readonly authors: readonly string[];
  readonly selectedRelays: readonly string[];
  readonly key: string;
  readonly subscriptions: import('./orchestrator-types').SubscriptionOrchestrator;
  readonly signal?: AbortSignal;
}): Promise<void> {
  return discoverAuthorRelayRoutes(input);
}
