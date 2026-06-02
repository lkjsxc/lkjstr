import { compareEventsDesc } from '../../protocol';
import type { FeedQuery, StoredEvent } from '../../events/types';
import {
  afterCursor,
  afterSince,
  before,
  beforeCursor,
  maxUntil,
} from '../../events/repository-shared';
import { feedDisplayKinds } from '../../events/feed-kinds';
import { ensureEventGraphSchema } from './event-schema';
import { decodeStoredEventRow, storedEventColumns } from './event-row-codec';
import { sendSqliteStorage } from './kernel-client';
import type { SqlParams } from './types';

export async function sqliteIndexedPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  if (query.kind === 'thread') return sqliteThreadPage(query, limit);
  if (query.kind === 'global')
    return sqliteKindsPage(feedKinds(query), query, limit);
  return sqliteAuthorPage(query, limit);
}

export async function sqliteLatestByAuthorKind(
  pubkey: string,
  kind: number,
): Promise<StoredEvent | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  return (
    await queryEvents('e.pubkey = ?1 AND e.kind = ?2', [pubkey, kind], 1)
  )?.[0];
}

export async function sqliteEventsByTagValue(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValue: string,
  limit = 500,
): Promise<StoredEvent[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  return queryTagEvents(tagName, tagValue, limit);
}

export async function sqliteEventsByTagValues(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValues: readonly string[],
  limit = 500,
): Promise<StoredEvent[] | undefined> {
  const pages = await Promise.all(
    [...new Set(tagValues)].map((value) =>
      sqliteEventsByTagValue(tagName, value, limit),
    ),
  );
  if (pages.some((page) => !page)) return undefined;
  return pages
    .flatMap((page) => page ?? [])
    .sort(compareEventsDesc)
    .slice(0, limit);
}

async function sqliteAuthorPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  const authors = [...new Set(query.authors ?? [])];
  if (authors.length === 0) return [];
  const per = Math.max(1, Math.ceil((limit * 3) / authors.length));
  const pages = await Promise.all(
    authors.flatMap((author) =>
      feedKinds(query).map((kind) => authorKindPage(author, kind, query, per)),
    ),
  );
  if (pages.some((page) => !page)) return undefined;
  return sortedBounded(
    pages.flatMap((page) => page ?? []),
    query,
    limit,
  );
}

async function sqliteKindsPage(
  kinds: readonly number[],
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  const pages = await Promise.all(
    kinds.map((kind) =>
      queryEvents(
        'e.kind = ?1 AND e.created_at <= ?2',
        [kind, maxUntil(query.until)],
        limit * 3,
      ),
    ),
  );
  if (pages.some((page) => !page)) return undefined;
  return sortedBounded(
    pages.flatMap((page) => page ?? []),
    query,
    limit,
  );
}

async function sqliteThreadPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  if (!query.eventId) return [];
  const [root, replies] = await Promise.all([
    queryEvents('e.id = ?1', [query.eventId], 1),
    queryTagEvents('e', query.eventId, limit * 3, maxUntil(query.until)),
  ]);
  if (!root || !replies) return undefined;
  return sortedBounded(
    [...root.filter((event) => before(event, query.until)), ...replies],
    query,
    limit,
  );
}

function authorKindPage(
  author: string,
  kind: number,
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  return queryEvents(
    'e.pubkey = ?1 AND e.kind = ?2 AND e.created_at <= ?3',
    [author, kind, maxUntil(query.until)],
    limit * 3,
  ).then((rows) =>
    rows?.filter((event) => withinBounds(event, query)).slice(0, limit),
  );
}

async function queryEvents(
  whereSql: string,
  params: SqlParams,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement: `SELECT ${storedEventColumns} FROM events e WHERE ${whereSql} ORDER BY e.created_at DESC, e.id DESC;`,
      params,
      rowLimit: limit,
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.flatMap((row) => decodeStoredEventRow(row) ?? []);
}

async function queryTagEvents(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValue: string,
  limit: number,
  until = Number.MAX_SAFE_INTEGER,
): Promise<StoredEvent[] | undefined> {
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement: `SELECT ${storedEventColumns} FROM event_tags t JOIN events e ON e.id = t.event_id WHERE t.tag_name = ?1 AND t.tag_value = ?2 AND t.created_at <= ?3 ORDER BY t.created_at DESC, t.event_id DESC;`,
      params: [tagName, tagValue, until],
      rowLimit: limit,
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.flatMap((row) => decodeStoredEventRow(row) ?? []);
}

function sortedBounded(
  events: readonly StoredEvent[],
  query: FeedQuery,
  limit: number,
): StoredEvent[] {
  return events
    .filter((event) => withinBounds(event, query))
    .sort(compareEventsDesc)
    .slice(0, limit);
}

function withinBounds(event: StoredEvent, query: FeedQuery): boolean {
  return (
    afterSince(event, query.since) &&
    before(event, query.until) &&
    beforeCursor(event, query.before) &&
    afterCursor(event, query.after)
  );
}

function feedKinds(query: FeedQuery): readonly number[] {
  return query.kinds ?? feedDisplayKinds;
}
