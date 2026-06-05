import { beforeCursor } from '$lib/events/repository-shared';
import type { FeedCursorPoint, StoredEvent } from '$lib/events/types';
import { feedDisplayKinds } from '$lib/events/feed-kinds';
import { compareEventsDesc } from '$lib/protocol';
import {
  normalizeSearchText,
  tokenizeSearchQuery,
} from '$lib/search/search-tokenizer';
import { ensureEventGraphSchema } from './event-schema';
import { decodeStoredEventRow, storedEventColumns } from './event-row-codec';
import { sendSqliteStorage } from './kernel-client';
import type { SqlScalar } from './types';

export async function sqliteSearchEvents(input: {
  readonly query: string;
  readonly limit: number;
  readonly before?: FeedCursorPoint;
  readonly kinds?: readonly number[];
}): Promise<StoredEvent[] | undefined> {
  const tokens = tokenizeSearchQuery(input.query);
  if (tokens.length === 0) return [];
  if (!(await ensureEventGraphSchema())) return undefined;
  const params: SqlScalar[] = [...tokens, tokens.length];
  const tokenSql = placeholders(1, tokens.length);
  const clauses = cursorClauses(params, input.before);
  addKindClause(clauses, params, input.kinds ?? feedDisplayKinds);
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement: `SELECT ${storedEventColumns} FROM events e JOIN (SELECT event_id FROM event_search_tokens WHERE token IN (${tokenSql}) GROUP BY event_id HAVING COUNT(DISTINCT token) = ?${tokens.length + 1}) m ON m.event_id = e.id WHERE ${clauses.join(' AND ')} ORDER BY e.created_at DESC, e.id ASC;`,
      params,
      rowLimit: Math.max(input.limit, Math.min(500, input.limit * 5)),
    },
    { deadlineMs: 3_000 },
  );
  if (response.outcome !== 'ok') return undefined;
  const normalized = normalizeSearchText(input.query.trim());
  return response.rows
    .flatMap((row) => decodeStoredEventRow(row) ?? [])
    .filter((event) => beforeCursor(event, input.before))
    .filter((event) => matchesQuery(event.content, normalized, tokens))
    .sort(compareEventsDesc)
    .slice(0, input.limit);
}

function cursorClauses(
  params: SqlScalar[],
  before?: FeedCursorPoint,
): string[] {
  if (!before) return ['1 = 1'];
  const createdAt = params.length + 1;
  const id = params.length + 2;
  params.push(before.createdAt, before.id);
  return [
    `(e.created_at < ?${createdAt} OR (e.created_at = ?${createdAt} AND e.id > ?${id}))`,
  ];
}

function addKindClause(
  clauses: string[],
  params: SqlScalar[],
  kinds: readonly number[],
): void {
  const unique = [...new Set(kinds)].slice(0, 100);
  if (unique.length === 0) return;
  clauses.push(`e.kind IN (${placeholders(params.length + 1, unique.length)})`);
  params.push(...unique);
}

function placeholders(start: number, count: number): string {
  return Array.from({ length: count }, (_, index) => `?${start + index}`).join(
    ', ',
  );
}

function matchesQuery(
  content: string,
  normalizedQuery: string,
  tokens: readonly string[],
): boolean {
  const normalized = normalizeSearchText(content);
  return (
    normalized.includes(normalizedQuery) ||
    tokens.every((token) => normalized.includes(token))
  );
}
