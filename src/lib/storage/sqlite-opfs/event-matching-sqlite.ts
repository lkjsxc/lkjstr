import {
  compareEventsDesc,
  matchesFilter,
  type NostrFilter,
} from '../../protocol';
import type { StoredEvent } from '../../events/types';
import { maxUntil } from '../../events/repository-shared';
import { ensureEventGraphSchema } from './event-schema';
import { decodeStoredEventRow, storedEventColumns } from './event-row-codec';
import { sqliteEventsByTagValues } from './event-pages-sqlite';
import { sqliteReadStoredEvents } from './events-sqlite';
import { sendSqliteStorage } from './kernel-client';
import type { SqlScalar } from './types';

export async function sqliteEventsMatching(
  filters: readonly NostrFilter[],
  limit = 500,
): Promise<StoredEvent[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  const cap = matchingLimit(filters, limit);
  const pages = await Promise.all(
    filters.map((filter) => sqliteFilterCandidates(filter, cap)),
  );
  if (pages.some((page) => !page)) return undefined;
  const byId = new Map<string, StoredEvent>();
  for (const event of pages.flatMap((page) => page ?? [])) {
    if (filters.some((filter) => matchesFilter(event, filter)))
      byId.set(event.id, event);
  }
  return [...byId.values()].sort(compareEventsDesc).slice(0, cap);
}

async function sqliteFilterCandidates(
  filter: NostrFilter,
  limit: number,
): Promise<StoredEvent[] | undefined> {
  const exactIds = filter.ids?.filter((id) => id.length === 64) ?? [];
  if (exactIds.length > 0)
    return normalizeCandidates(await sqliteReadStoredEvents(exactIds), limit);
  const tagFilter = firstTagFilter(filter);
  if (tagFilter)
    return sqliteEventsByTagValues(tagFilter.name, tagFilter.values, limit * 3);
  const clauses: string[] = ['e.created_at <= ?1'];
  const params: SqlScalar[] = [maxUntil(filter.until)];
  addInClause(clauses, params, 'e.pubkey', filter.authors);
  addInClause(clauses, params, 'e.kind', filter.kinds);
  return queryCandidates(clauses.join(' AND '), params, limit * 3);
}

async function queryCandidates(
  whereSql: string,
  params: readonly SqlScalar[],
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

function addInClause(
  clauses: string[],
  params: SqlScalar[],
  column: string,
  values: readonly (string | number)[] | undefined,
): void {
  const unique = [...new Set(values ?? [])].slice(0, 400);
  if (unique.length === 0) return;
  const placeholders = unique.map(
    (_, index) => `?${params.length + index + 1}`,
  );
  clauses.push(`${column} IN (${placeholders.join(', ')})`);
  params.push(...unique);
}

function firstTagFilter(
  filter: NostrFilter,
):
  | { readonly name: 'e' | 'p' | 'q' | 'a'; readonly values: readonly string[] }
  | undefined {
  for (const [key, values] of Object.entries(filter)) {
    if (
      key.length === 2 &&
      ['#e', '#p', '#q', '#a'].includes(key) &&
      Array.isArray(values)
    )
      return { name: key.slice(1) as 'e' | 'p' | 'q' | 'a', values };
  }
  return undefined;
}

function normalizeCandidates(
  events: readonly (StoredEvent | undefined)[] | undefined,
  limit: number,
): StoredEvent[] | undefined {
  if (!events) return undefined;
  return events
    .filter((event): event is StoredEvent => Boolean(event))
    .slice(0, limit * 3);
}

function matchingLimit(filters: readonly NostrFilter[], limit: number): number {
  const requested = filters.flatMap((filter) =>
    filter.limit === undefined ? [] : [filter.limit],
  );
  return Math.max(
    1,
    Math.min(limit, requested.length ? Math.max(...requested) : limit),
  );
}
