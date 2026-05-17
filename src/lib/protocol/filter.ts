import { isEventId, isPubkey, type NostrEvent } from './event';

export type NostrFilter = {
  readonly ids?: readonly string[];
  readonly authors?: readonly string[];
  readonly kinds?: readonly number[];
  readonly since?: number;
  readonly until?: number;
  readonly limit?: number;
  readonly search?: string;
  readonly [tag: `#${string}`]: readonly string[] | number | string | undefined;
};

export function parseFilter(value: unknown): NostrFilter | undefined {
  if (!isRecord(value)) return undefined;
  const filter: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'ids' && isStringArray(item, isEventId)) filter.ids = item;
    else if (key === 'authors' && isStringArray(item, isPubkey))
      filter.authors = item;
    else if (key === 'kinds' && isNumberArray(item)) filter.kinds = item;
    else if (
      (key === 'since' || key === 'until' || key === 'limit') &&
      isNat(item)
    )
      filter[key] = item;
    else if (key === 'search' && typeof item === 'string') filter.search = item;
    else if (key.startsWith('#') && key.length === 2 && isStringArray(item))
      filter[key] = item;
    else return undefined;
  }
  return filter as NostrFilter;
}

export function matchesFilter(event: NostrEvent, filter: NostrFilter): boolean {
  if (filter.ids && !hasPrefix(filter.ids, event.id)) return false;
  if (filter.authors && !hasPrefix(filter.authors, event.pubkey)) return false;
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since !== undefined && event.created_at < filter.since)
    return false;
  if (filter.until !== undefined && event.created_at > filter.until)
    return false;
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith('#') || !Array.isArray(values)) continue;
    if (
      !event.tags.some(
        (tag) => tag[0] === key.slice(1) && tag[1] && values.includes(tag[1]),
      )
    )
      return false;
  }
  return true;
}

export function matchesAnyFilter(
  event: NostrEvent,
  filters: readonly NostrFilter[],
): boolean {
  return filters.some((filter) => matchesFilter(event, filter));
}

function hasPrefix(prefixes: readonly string[], value: string): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(
  value: unknown,
  guard?: (value: string) => boolean,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && (!guard || guard(item)))
  );
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => Number.isInteger(item) && item >= 0)
  );
}

function isNat(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
