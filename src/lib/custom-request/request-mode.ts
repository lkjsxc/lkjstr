import type { NostrFilter } from '$lib/protocol';

export type CustomRequestMode = 'adaptive-feed' | 'exact';

export function customRequestMode(
  filters: readonly NostrFilter[],
): CustomRequestMode {
  return filters.some((filter) => filter.ids?.length || filter.search)
    ? 'exact'
    : 'adaptive-feed';
}
