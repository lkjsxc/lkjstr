import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import {
  feedCoverageLedgerRecord,
  feedCursorLedgerRecord,
  feedScanHintLedgerRecord,
} from '../../events/feed-cache-ledger';
import { jobLedgerRecord } from '../../jobs/job-ledger';
import { notificationLedgerRecord } from '../../notifications/notification-ledger';
import {
  relayInfoLedgerRecord,
  relayRouteLedgerRecord,
  relaySummaryLedgerRecord,
  relaySuggestionLedgerRecord,
} from '../../relays/relay-cache-ledger';
import { tabStateLedgerRecord } from '../../workspace/tab-state-ledger';
import { sqliteEventRepairChunk } from './cache-ledger-repair-events-sqlite';
import { ensureEventGraphSchema } from './event-schema';
import { ensureRelayCacheSchema } from './relay-cache-schema';
import { ensureTabStateSchema } from './tab-states-sqlite';
import { sendSqliteStorage } from './kernel-client';
import type { SqlRow, SqlScalar } from './types';

export type RepairChunk = {
  readonly rows: readonly CacheLedgerRecord[];
  readonly nextCursor?: string;
  readonly unavailable?: boolean;
};
type Collector = (cursor: string, limit: number) => Promise<RepairChunk>;

export type RepairRowProgress = {
  readonly scannedResources: number;
  readonly unavailableTargets: number;
};

export async function collectSqliteRepairRows(
  visit: (record: CacheLedgerRecord) => Promise<void>,
  limit: number,
): Promise<RepairRowProgress> {
  let scannedResources = 0;
  let unavailableTargets = 0;
  for (const collector of collectors()) {
    let cursor = '';
    while (true) {
      const chunk = await collector(cursor, limit);
      if (chunk.unavailable) {
        unavailableTargets += 1;
        break;
      }
      if (chunk.rows.length === 0 && !chunk.nextCursor) break;
      for (const row of chunk.rows) await visit(row);
      scannedResources += chunk.rows.length;
      if (!chunk.nextCursor) break;
      cursor = chunk.nextCursor;
    }
  }
  return { scannedResources, unavailableTargets };
}

function jsonCollector<T>(input: {
  readonly ensure: () => Promise<boolean>;
  readonly table: string;
  readonly key: string;
  readonly record: (row: T) => CacheLedgerRecord;
}): Collector {
  return async (cursor, limit) => {
    if (!(await input.ensure())) return unavailableChunk();
    const rows = await queryRows(
      `SELECT ${input.key}, record_json FROM ${input.table} WHERE ${input.key} > ?1 ORDER BY ${input.key} ASC LIMIT ?2;`,
      [cursor, limit],
      limit,
    );
    if (!rows) return unavailableChunk();
    return {
      rows: rows
        .flatMap((row) => decodeJson<T>(row.record_json))
        .map(input.record),
      nextCursor: nextCursor(rows, input.key, limit),
    };
  };
}

function collectors(): readonly Collector[] {
  return [
    sqliteEventRepairChunk,
    jsonCollector({
      ensure: ensureEventGraphSchema,
      table: 'notifications',
      key: 'id',
      record: notificationLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureEventGraphSchema,
      table: 'feed_cursors',
      key: 'id',
      record: feedCursorLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureEventGraphSchema,
      table: 'feed_coverage',
      key: 'id',
      record: feedCoverageLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureEventGraphSchema,
      table: 'feed_scan_hints',
      key: 'id',
      record: feedScanHintLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureRelayCacheSchema,
      table: 'jobs',
      key: 'id',
      record: jobLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureRelayCacheSchema,
      table: 'relay_diagnostic_summaries',
      key: 'relay_url',
      record: relaySummaryLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureRelayCacheSchema,
      table: 'relay_information',
      key: 'relay_url',
      record: relayInfoLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureRelayCacheSchema,
      table: 'relay_list_suggestions',
      key: 'id',
      record: relaySuggestionLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureRelayCacheSchema,
      table: 'author_relay_routes',
      key: 'id',
      record: relayRouteLedgerRecord,
    }),
    jsonCollector({
      ensure: ensureTabStateSchema,
      table: 'tab_states',
      key: 'id',
      record: tabStateLedgerRecord,
    }),
  ];
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

function nextCursor(
  rows: readonly SqlRow[],
  key: string,
  limit: number,
): string | undefined {
  return rows.length >= limit
    ? String(rows[rows.length - 1]?.[key] ?? '')
    : undefined;
}

function unavailableChunk(): RepairChunk {
  return { rows: [], unavailable: true };
}

function decodeJson<T>(raw: unknown): T[] {
  if (typeof raw !== 'string') return [];
  try {
    return [JSON.parse(raw) as T];
  } catch {
    return [];
  }
}
