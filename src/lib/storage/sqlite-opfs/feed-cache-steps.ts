import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { FeedScanHint } from '../../events/feed-scan-hints';
import type { FeedCoverage } from '../../events/types';
import type { SqlStep } from './types';

export function feedDeleteSteps(
  table: string,
  ownerKind: CacheLedgerRecord['ownerKind'],
  ids: readonly string[],
): SqlStep[] {
  return chunks([...new Set(ids)], 250).flatMap((chunk) => [
    deleteStep(table, 'id', chunk),
    deleteLedgerStep(ownerKind, chunk),
  ]);
}

export function feedDeleteAllSteps(
  table: string,
  ownerKind: CacheLedgerRecord['ownerKind'],
): SqlStep[] {
  return [
    { statement: `DELETE FROM ${table};` },
    {
      statement: 'DELETE FROM cache_ledger WHERE owner_kind = ?1;',
      params: [ownerKind],
    },
  ];
}

export function coverageStep(row: FeedCoverage): SqlStep {
  return {
    statement:
      'INSERT INTO feed_coverage (id, feed_key, relay_url, group_key, status, filter_key, since, until, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(id) DO UPDATE SET status = excluded.status, filter_key = excluded.filter_key, since = excluded.since, until = excluded.until, record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.feedKey,
      row.relayUrl,
      row.groupKey,
      row.status,
      row.filterKey,
      row.since ?? null,
      row.until ?? null,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}

export function scanHintStep(row: FeedScanHint): SqlStep {
  return {
    statement:
      'INSERT INTO feed_scan_hints (id, scan_key, relay_url, group_key, filter_key, direction, record_json, updated_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms;',
    params: [
      row.id,
      row.scanKey,
      row.relayUrl,
      row.groupKey,
      row.filterKey,
      row.direction,
      JSON.stringify(row),
      row.updatedAt,
    ],
  };
}

function deleteStep(
  table: string,
  key: string,
  ids: readonly string[],
): SqlStep {
  return {
    statement: `DELETE FROM ${table} WHERE ${key} IN (${placeholders(ids)});`,
    params: ids,
  };
}

function deleteLedgerStep(
  ownerKind: CacheLedgerRecord['ownerKind'],
  ids: readonly string[],
): SqlStep {
  return {
    statement: `DELETE FROM cache_ledger WHERE owner_kind = ?1 AND resource_id IN (${placeholders(ids, 2)});`,
    params: [ownerKind, ...ids],
  };
}

function placeholders(values: readonly unknown[], start = 1): string {
  return values.map((_, index) => `?${index + start}`).join(', ');
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < values.length; index += size)
    out.push(values.slice(index, index + size));
  return out;
}
