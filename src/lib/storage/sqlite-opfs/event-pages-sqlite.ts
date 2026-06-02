import { compareEventsDesc } from '../../protocol';
import type { FeedQuery, StoredEvent } from '../../events/types';
import {
  afterCursor,
  afterSince,
  before,
  beforeCursor,
  maxUntil,
} from '../../events/repository-shared';
import { ensureEventGraphSchema } from './event-schema';
import { decodeStoredEventRow, storedEventColumns } from './event-row-codec';
import { sendSqliteStorage } from './kernel-client';
import {
  authorChunkSize,
  boundParamCount,
  boundsParams,
  boundsSql,
  chunks,
  feedKinds,
  kindSql,
  relayWhere,
  valueRows,
} from './event-pages-sql';
import type { SqlParams } from './types';

export async function sqliteIndexedPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  if (query.kind === 'thread') return sqliteThreadPage(query, limit);
  if (query.kind === 'global') return sqliteKindsPage(query, limit);
  return sqliteAuthorPage(query, limit);
}

export async function sqliteLatestByAuthorKind(
  pubkey: string,
  kind: number,
): Promise<StoredEvent | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  return (
    await queryEvents(
      whereSelect('e.pubkey = ?1 AND e.kind = ?2'),
      [pubkey, kind],
      1,
    )
  )?.[0];
}

export async function sqliteEventsByTagValue(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValue: string,
  limit = 500,
): Promise<StoredEvent[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  return queryTagValues(tagName, [tagValue], limit);
}

export async function sqliteEventsByTagValues(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValues: readonly string[],
  limit = 500,
): Promise<StoredEvent[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  return queryTagValues(tagName, [...new Set(tagValues)], limit);
}

async function sqliteAuthorPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  const authors = [...new Set(query.authors ?? [])];
  if (authors.length === 0) return [];
  const pages = await Promise.all(
    chunks(authors, authorChunkSize(query)).map((chunk) =>
      queryAuthorChunk(chunk, feedKinds(query), query, limit + 1),
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
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  if (query.relays && query.relays.length === 0) return [];
  const sql = `SELECT ${storedEventColumns} FROM events e WHERE ${kindSql(feedKinds(query), 1)} ${boundsSql(query, feedKinds(query).length + 1)} ${relayWhere(query, feedKinds(query).length + boundParamCount(query) + 1)} ORDER BY e.created_at DESC, e.id ASC;`;
  const params = [
    ...feedKinds(query),
    ...boundsParams(query),
    ...(query.relays ?? []),
  ];
  return queryEvents(sql, params, limit + 1);
}

async function sqliteThreadPage(
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  if (!query.eventId) return [];
  const [root, replies] = await Promise.all([
    queryEvents(whereSelect('e.id = ?1'), [query.eventId], 1),
    queryTagValues('e', [query.eventId], limit * 3, maxUntil(query.until)),
  ]);
  if (!root || !replies) return undefined;
  return sortedBounded(
    [...root.filter((event) => before(event, query.until)), ...replies],
    query,
    limit,
  );
}

function queryAuthorChunk(
  authors: readonly string[],
  kinds: readonly number[],
  query: FeedQuery,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  const authorValues = valueRows(authors, 1);
  const kindStart = authors.length + 1;
  const boundStart = kindStart + kinds.length;
  const relayStart = boundStart + boundParamCount(query);
  const sql = `WITH author_input(pubkey) AS (VALUES ${authorValues}) SELECT ${storedEventColumns} FROM events e JOIN author_input a ON a.pubkey = e.pubkey WHERE ${kindSql(kinds, kindStart)} ${boundsSql(query, boundStart)} ${relayWhere(query, relayStart)} ORDER BY e.created_at DESC, e.id ASC;`;
  return queryEvents(
    sql,
    [...authors, ...kinds, ...boundsParams(query), ...(query.relays ?? [])],
    limit,
  );
}

async function queryTagValues(
  tagName: 'e' | 'p' | 'q' | 'a',
  tagValues: readonly string[],
  limit: number,
  until = Number.MAX_SAFE_INTEGER,
): Promise<StoredEvent[] | undefined> {
  if (tagValues.length === 0) return [];
  const values = valueRows(tagValues, 3);
  const sql = `WITH tag_input(tag_value) AS (VALUES ${values}) SELECT ${storedEventColumns} FROM event_tags t JOIN tag_input i ON i.tag_value = t.tag_value JOIN events e ON e.id = t.event_id WHERE t.tag_name = ?1 AND t.created_at <= ?2 ORDER BY e.created_at DESC, e.id ASC;`;
  return queryEvents(sql, [tagName, until, ...tagValues], limit);
}

async function queryEvents(
  statement: string,
  params: SqlParams,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  const response = await sendSqliteStorage(
    { kind: 'query', statement, params, rowLimit: limit },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  return response.rows.flatMap((row) => decodeStoredEventRow(row) ?? []);
}

function whereSelect(whereSql: string): string {
  return `SELECT ${storedEventColumns} FROM events e WHERE ${whereSql} ORDER BY e.created_at DESC, e.id ASC;`;
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
