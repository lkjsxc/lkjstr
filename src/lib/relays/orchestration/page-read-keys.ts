import type { NostrFilter } from '$lib/protocol';
import type { RelayRouteGroup } from '../relay-route-types';
import type { FeedCursorPoint } from '../../events/types';
import type { PageIntent } from './intent-types';

export function pageIntentSemanticKey(intent: PageIntent): string {
  const bounds = pageIntentBounds(intent);
  const raw = [
    stableIntentPart(intent),
    cursorKey(bounds.before),
    cursorKey(bounds.after),
    intent.routeFingerprint ?? '',
    intent.direction,
  ].join('|');
  return `page:${hashSemanticKey(raw)}`;
}

export function pageIntentScanKey(intent: PageIntent): string {
  return `scan:${hashSemanticKey(stableIntentPart(intent))}`;
}

export function pageIntentBounds(intent: PageIntent): {
  readonly before?: FeedCursorPoint;
  readonly after?: FeedCursorPoint;
} {
  if (intent.before || intent.after)
    return { before: intent.before, after: intent.after };
  if (intent.direction === 'older') return { before: intent.cursor };
  if (intent.direction === 'newer') return { after: intent.cursor };
  return {};
}

export function routeGroupFingerprint(
  groups: readonly RelayRouteGroup[],
): string {
  const records = groups
    .map((group) => [
      group.key,
      [...group.relays].sort(),
      [...(group.authors ?? [])].sort(),
      group.source,
    ])
    .sort((left, right) =>
      JSON.stringify(left).localeCompare(JSON.stringify(right)),
    );
  return JSON.stringify(records);
}

function stableIntentPart(intent: PageIntent): string {
  return [
    intent.surface,
    intent.phase,
    [...intent.authors].sort().join(','),
    String(intent.pageSize),
    [...intent.selectedRelays].sort().join('\u0000'),
    intent.purpose ?? 'feed',
    relayFilterKey(intent.relayFilters ?? []),
  ].join('|');
}

function hashSemanticKey(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36).padStart(8, '0').slice(0, 8);
}

function cursorKey(cursor: FeedCursorPoint | undefined): string {
  return cursor ? `${cursor.createdAt}:${cursor.id}` : '';
}

function relayFilterKey(filters: readonly NostrFilter[]): string {
  return JSON.stringify(filters.map(normalizeFilter));
}

function normalizeFilter(filter: NostrFilter): Record<string, unknown> {
  const entries: [string, unknown][] = Object.entries(filter).map(
    ([key, value]) => [key, normalizeFilterValue(value)],
  );
  return Object.fromEntries(
    entries.sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeFilterValue(value: unknown): unknown {
  return Array.isArray(value) ? [...value].sort() : value;
}
