import { feedDisplayKinds } from '../events/feed-kinds';
import type { NostrFilter } from '../protocol';
import { authorFilters } from '../timeline/follow-list';

const forbiddenWireKeys = new Set([
  'depth',
  'source',
  'feedKey',
  'cursor',
  'direction',
  'profile',
  'mode',
]);

export type TimelineCursorBounds = Pick<NostrFilter, 'since' | 'until'>;

export type TimelineFilterInput =
  | {
      readonly kind: 'home';
      readonly followPubkeys: readonly string[];
      readonly activePubkey: string;
      readonly cursor: TimelineCursorBounds;
      readonly limit: number;
    }
  | {
      readonly kind: 'global';
      readonly cursor: TimelineCursorBounds;
      readonly limit: number;
    }
  | {
      readonly kind: 'profile';
      readonly authorPubkey: string;
      readonly cursor: TimelineCursorBounds;
      readonly limit: number;
    };

export function buildTimelineFilters(
  input: TimelineFilterInput,
): readonly NostrFilter[] {
  const filters = buildTimelineFiltersUnsafe(input);
  for (const filter of filters) assertRelayFilterIsProtocolSafe(filter);
  return filters;
}

function buildTimelineFiltersUnsafe(
  input: TimelineFilterInput,
): readonly NostrFilter[] {
  if (input.kind === 'home') {
    if (input.followPubkeys.length === 0) return [];
    const authors = uniquePubkeys([input.activePubkey, ...input.followPubkeys]);
    return authorFilters(authors, input.limit, input.cursor, 'per-filter');
  }
  if (input.kind === 'global') {
    return [{ kinds: feedDisplayKinds, limit: input.limit, ...input.cursor }];
  }
  return authorFilters(
    [input.authorPubkey],
    input.limit,
    input.cursor,
    'per-filter',
  );
}

export function assertRelayFilterIsProtocolSafe(filter: NostrFilter): void {
  for (const key of Object.keys(filter))
    if (forbiddenWireKeys.has(key))
      throw new Error(`protocol-unsafe filter key: ${key}`);
}

function uniquePubkeys(pubkeys: readonly string[]): string[] {
  return [...new Set(pubkeys)];
}
