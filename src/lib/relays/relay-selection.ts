import { normalizeRelayUrl } from '../protocol';
import {
  selectedDefaultRelaySet,
  type RelayRecord,
  type RelaySet,
} from './relay-store';

type RelayMode = 'read' | 'write';

export function userRelaySets(relaySets: readonly RelaySet[]): RelaySet[] {
  return relaySets.filter((set) => set.purpose === 'user');
}

export function discoveryRelaySets(relaySets: readonly RelaySet[]): RelaySet[] {
  return relaySets.filter((set) => set.purpose === 'discovery');
}

export function selectedUserReadRelays(
  relaySets: readonly RelaySet[],
): string[] {
  return selectedUserRelayUrls(relaySets, 'read');
}

export function selectedUserWriteRelays(
  relaySets: readonly RelaySet[],
): string[] {
  return selectedUserRelayUrls(relaySets, 'write');
}

export function enabledDiscoveryRelays(
  relaySets: readonly RelaySet[],
): string[] {
  return sortedRelayUrls(
    discoveryRelaySets(relaySets).flatMap((set) =>
      set.relays.filter((relay) => relay.enabled).map((relay) => relay.url),
    ),
  );
}

export function sortedRelayUrls(relays: readonly string[]): string[] {
  return [
    ...new Set(
      relays
        .map(normalizeRelayUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  ].sort();
}

function selectedUserRelayUrls(
  relaySets: readonly RelaySet[],
  mode: RelayMode,
): string[] {
  const set = selectedDefaultRelaySet(relaySets);
  return sortedRelayUrls(
    set?.relays.filter(enabledFor(mode)).map((relay) => relay.url) ?? [],
  );
}

function enabledFor(mode: RelayMode): (relay: RelayRecord) => boolean {
  return (relay) => relay.enabled && relay[mode];
}
