import { maxUntil } from '../../events/repository-shared';
import { feedDisplayKinds } from '../../events/feed-kinds';
import type { FeedQuery } from '../../events/types';
import type { SqlScalar } from './types';

export function kindSql(kinds: readonly number[], start: number): string {
  return `e.kind IN (${placeholders(kinds, start)})`;
}

export function boundsSql(query: FeedQuery, start: number): string {
  const parts = ['e.created_at <= ?' + start];
  let next = start + 1;
  if (query.since !== undefined) parts.push('e.created_at >= ?' + next++);
  if (query.before) {
    parts.push(
      `(e.created_at < ?${next} OR (e.created_at = ?${next + 1} AND e.id > ?${next + 2}))`,
    );
    next += 3;
  }
  if (query.after)
    parts.push(
      `(e.created_at > ?${next} OR (e.created_at = ?${next + 1} AND e.id < ?${next + 2}))`,
    );
  return parts.map((part) => `AND ${part}`).join(' ');
}

export function boundsParams(query: FeedQuery): SqlScalar[] {
  return [
    maxUntil(query.until),
    ...(query.since !== undefined ? [query.since] : []),
    ...(query.before
      ? [query.before.createdAt, query.before.createdAt, query.before.id]
      : []),
    ...(query.after
      ? [query.after.createdAt, query.after.createdAt, query.after.id]
      : []),
  ];
}

export function boundParamCount(query: FeedQuery): number {
  return boundsParams(query).length;
}

export function relayWhere(query: FeedQuery, start: number): string {
  return query.relays
    ? `AND EXISTS (SELECT 1 FROM event_relays r WHERE r.event_id = e.id AND r.relay_url IN (${placeholders(query.relays, start)}))`
    : '';
}

export function feedKinds(query: FeedQuery): readonly number[] {
  return query.kinds ?? feedDisplayKinds;
}

export function valueRows(values: readonly unknown[], start: number): string {
  return values.map((_, index) => `(?${start + index})`).join(', ');
}

export function chunks<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    out.push(values.slice(index, index + size));
  return out;
}

export function authorChunkSize(query: FeedQuery): number {
  return Math.max(
    1,
    Math.floor(
      (900 -
        feedKinds(query).length -
        boundParamCount(query) -
        (query.relays?.length ?? 0)) /
        2,
    ),
  );
}

function placeholders(values: readonly unknown[], start = 1): string {
  return values.map((_, index) => `?${start + index}`).join(', ');
}
