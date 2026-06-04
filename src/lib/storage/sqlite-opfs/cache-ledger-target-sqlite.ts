import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { CacheLedgerTargetState } from '../../cache/cache-ledger-target';
import { ensureEventGraphSchema } from './event-schema';
import { ensureRelayCacheSchema } from './relay-cache-schema';
import { ensureTabStateSchema } from './tab-states-sqlite';
import { sendSqliteStorage } from './kernel-client';
import type { SqlRow, SqlScalar } from './types';

export async function sqliteCacheLedgerTargetState(
  row: CacheLedgerRecord,
): Promise<CacheLedgerTargetState> {
  const target = targetFor(row.resourceKind);
  if (!target || !(await target.ensure())) return 'unavailable';
  const rows = await queryRows(
    `SELECT 1 AS found FROM ${target.table} WHERE ${target.key} = ?1 LIMIT 1;`,
    [row.resourceId],
    1,
  );
  if (!rows) return 'unavailable';
  return rows.length > 0 ? 'present' : 'missing';
}

function targetFor(kind: CacheLedgerRecord['resourceKind']) {
  return targetMap[kind];
}

const targetMap = {
  'nostr-event': eventTarget('events', 'id'),
  'notification-record': eventTarget('notifications', 'id'),
  'feed-cursor': eventTarget('feed_cursors', 'id'),
  'coverage-row': eventTarget('feed_coverage', 'id'),
  'scan-hint': eventTarget('feed_scan_hints', 'id'),
  'tab-state': {
    table: 'tab_states',
    key: 'id',
    ensure: ensureTabStateSchema,
  },
  'relay-summary': relayTarget('relay_diagnostic_summaries', 'relay_url'),
  'relay-info': relayTarget('relay_information', 'relay_url'),
  'relay-list-suggestion': relayTarget('relay_list_suggestions', 'id'),
  'author-relay-route': relayTarget('author_relay_routes', 'id'),
  'job-record': relayTarget('jobs', 'id'),
} satisfies Partial<Record<CacheLedgerRecord['resourceKind'], TargetSpec>>;

type TargetSpec = {
  readonly table: string;
  readonly key: string;
  readonly ensure: () => Promise<boolean>;
};

function eventTarget(table: string, key: string): TargetSpec {
  return { table, key, ensure: ensureEventGraphSchema };
}

function relayTarget(table: string, key: string): TargetSpec {
  return { table, key, ensure: ensureRelayCacheSchema };
}

async function queryRows(
  statement: string,
  params: readonly SqlScalar[],
  rowLimit: number,
): Promise<readonly SqlRow[] | undefined> {
  const response = await sendSqliteStorage({
    kind: 'query',
    statement,
    params,
    rowLimit,
  });
  return response.outcome === 'ok' ? response.rows : undefined;
}
