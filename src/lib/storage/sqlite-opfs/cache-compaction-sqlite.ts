import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import { ensureEventGraphSchema } from './event-schema';
import { sendSqliteStorage } from './kernel-client';
import type { SqlStep } from './types';

const directTables: Record<string, string> = {
  'notification-record': 'notifications',
  'feed-cursor': 'feed_cursors',
  'coverage-row': 'feed_coverage',
  'scan-hint': 'feed_scan_hints',
  'tab-state': 'tab_states',
  'relay-summary': 'relay_diagnostic_summaries',
  'relay-info': 'relay_information',
  'relay-list-suggestion': 'relay_list_suggestions',
  'author-relay-route': 'author_relay_routes',
  'job-record': 'jobs',
};

export async function sqliteDeleteEventCacheRows(
  rows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  if (rows.length === 0) return true;
  if (!(await ensureEventGraphSchema())) return false;
  return sqliteBatch(chunks(rows, 250).flatMap(eventDeleteSteps));
}

export async function sqliteDeleteDirectCacheRows(
  rows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  if (rows.length === 0) return true;
  if (!(await ensureEventGraphSchema())) return false;
  return sqliteBatch(chunks(rows, 250).flatMap(directDeleteSteps));
}

function eventDeleteSteps(rows: readonly CacheLedgerRecord[]): SqlStep[] {
  const eventIds = rows.map((row) => row.resourceId);
  const ledgerIds = rows.map((row) => row.id);
  return [
    deleteIn('event_relays', 'event_id', eventIds),
    deleteIn('event_tags', 'event_id', eventIds),
    deleteIn('events', 'id', eventIds),
    deleteIn('cache_ledger', 'id', ledgerIds),
    { statement: `DELETE FROM feed_cursors;` },
    {
      statement:
        "DELETE FROM cache_ledger WHERE owner_kind IN ('feed-page', 'feed-coverage', 'feed-scan-hint');",
    },
  ];
}

function directDeleteSteps(rows: readonly CacheLedgerRecord[]): SqlStep[] {
  const ledgerIds = rows.map((row) => row.id);
  return [
    ...Object.entries(groupResourceIds(rows)).flatMap(([kind, ids]) => {
      const table = directTables[kind];
      return table ? [deleteIn(table, 'id', ids)] : [];
    }),
    deleteIn('cache_ledger', 'id', ledgerIds),
  ];
}

async function sqliteBatch(steps: readonly SqlStep[]): Promise<boolean> {
  const response = await sendSqliteStorage(
    { kind: 'batch', mode: 'readwrite', steps },
    { deadlineMs: 10_000 },
  );
  return response.outcome === 'ok';
}

function groupResourceIds(
  rows: readonly CacheLedgerRecord[],
): Record<string, string[]> {
  return rows.reduce<Record<string, string[]>>((groups, row) => {
    groups[row.resourceKind] = [
      ...(groups[row.resourceKind] ?? []),
      row.resourceId,
    ];
    return groups;
  }, {});
}

function deleteIn(
  table: string,
  column: string,
  values: readonly string[],
): SqlStep {
  return {
    statement: `DELETE FROM ${table} WHERE ${column} IN (${placeholders(values)});`,
    params: values,
  };
}

function placeholders(values: readonly unknown[]): string {
  return values.map((_, index) => `?${index + 1}`).join(', ');
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    out.push(values.slice(index, index + size));
  return out;
}
