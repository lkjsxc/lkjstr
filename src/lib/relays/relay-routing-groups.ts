import { normalizeRelayUrl } from '../protocol';
import type { RelayRouteGroup } from './relay-route-types';

export function fallbackGroups(
  authors: readonly string[],
  relays: readonly string[],
  source: RelayRouteGroup['source'],
  limit: number,
): RelayRouteGroup[] {
  if (authors.length === 0)
    return relays.length ? [{ key: `${source}:0`, relays, source }] : [];
  const groups: RelayRouteGroup[] = [];
  for (let index = 0; index < authors.length; index += limit)
    groups.push({
      key: `${source}:${index}`,
      relays,
      authors: authors.slice(index, index + limit),
      source,
    });
  return groups;
}

export function mergeRelays(groups: readonly RelayRouteGroup[]): string[] {
  return dedupe(groups.flatMap((group) => group.relays));
}

export function normalizeRelays(
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

export function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}
