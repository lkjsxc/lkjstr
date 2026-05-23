import type { RelayRouteGroup } from '$lib/relays/relay-route-types';
import { discoveryRelays } from '$lib/relays/relay-routing';
import { normalizedRelayList } from '$lib/relays/relay-url-list';

export function profileContentRelays(
  relays: readonly string[],
  selectedRelays: readonly string[],
): string[] {
  const selected = new Set(normalizedRelayList(selectedRelays));
  const discovery = new Set(normalizedRelayList(discoveryRelays));
  return relays.filter((relay) => !discovery.has(relay) || selected.has(relay));
}

export function profileContentGroups(
  groups: readonly RelayRouteGroup[],
  selectedRelays: readonly string[],
): RelayRouteGroup[] {
  return groups
    .map((group) => ({
      ...group,
      relays: profileContentRelays(group.relays, selectedRelays),
    }))
    .filter((group) => group.relays.length > 0);
}
