import type { RelayRouteGroup } from '$lib/relays/relay-route-types';

export function profileContentRelays(relays: readonly string[]): string[] {
  return [...relays];
}

export function profileContentGroups(
  groups: readonly RelayRouteGroup[],
): RelayRouteGroup[] {
  return groups
    .filter((group) => group.source !== 'discovery')
    .map((group) => ({
      ...group,
      relays: profileContentRelays(group.relays),
    }))
    .filter((group) => group.relays.length > 0);
}
