import type { NostrFilter } from '../protocol';

const protocolKeys = new Set([
  'ids',
  'authors',
  'kinds',
  'since',
  'until',
  'limit',
  'search',
]);

export function relaySafeFilter(filter: NostrFilter): NostrFilter {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined) continue;
    if (protocolKeys.has(key) || /^#[A-Za-z]$/.test(key)) safe[key] = value;
  }
  return safe as NostrFilter;
}

export function relaySafeFilters(
  filters: readonly NostrFilter[],
): NostrFilter[] {
  return filters.map(relaySafeFilter);
}
