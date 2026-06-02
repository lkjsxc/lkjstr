import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { FeedScanHint } from '../../events/feed-scan-hints';
import type { FeedCoverage } from '../../events/types';
import { ensureEventGraphSchema } from './event-schema';
import {
  coverageStep,
  feedDeleteAllSteps,
  feedDeleteSteps,
  scanHintStep,
} from './feed-cache-steps';
import {
  cacheLedgerSqlStep,
  sqliteRecordBatch,
  sqliteRecordReadMany,
} from './sqlite-record-helpers';
import type { SqlStep } from './types';

export function sqlitePutFeedCoverageRows(
  rows: readonly FeedCoverage[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  return batch([
    ...rows.map(coverageStep),
    ...ledgerRows.map(cacheLedgerSqlStep),
  ]);
}

export function sqliteReadFeedCoverageRows(
  feedKey: string,
): Promise<FeedCoverage[] | undefined> {
  return sqliteRecordReadMany<FeedCoverage>(
    ensureEventGraphSchema,
    'feed_coverage',
    'feed_key = ?1 ORDER BY updated_at_ms DESC',
    [feedKey],
    5000,
  );
}

export async function sqliteDeleteFeedCoverageByFeedKeys(
  feedKeys: readonly string[],
): Promise<boolean> {
  const rows = await Promise.all(
    [...new Set(feedKeys)].map((feedKey) =>
      sqliteReadFeedCoverageRows(feedKey),
    ),
  );
  if (rows.some((row) => !row)) return false;
  return deleteByIds(
    'feed_coverage',
    'feed-coverage',
    rows.flatMap((row) => row ?? []),
  );
}

export async function sqliteDeleteExpiredFeedCoverage(
  expired: (coverage: FeedCoverage) => boolean,
): Promise<boolean> {
  const rows = await readAll<FeedCoverage>('feed_coverage');
  if (!rows) return false;
  return deleteByIds('feed_coverage', 'feed-coverage', rows.filter(expired));
}

export function sqliteDeleteAllFeedCoverage(): Promise<boolean> {
  return deleteAll('feed_coverage', 'feed-coverage');
}

export function sqlitePutFeedScanHint(
  hint: FeedScanHint,
  ledgerRow: CacheLedgerRecord,
): Promise<boolean> {
  return batch([scanHintStep(hint), cacheLedgerSqlStep(ledgerRow)]);
}

export function sqliteReadFeedScanHints(input: {
  readonly scanKey: string;
  readonly direction: FeedScanHint['direction'];
}): Promise<FeedScanHint[] | undefined> {
  return sqliteRecordReadMany<FeedScanHint>(
    ensureEventGraphSchema,
    'feed_scan_hints',
    'scan_key = ?1 AND direction = ?2 ORDER BY updated_at_ms DESC',
    [input.scanKey, input.direction],
    5000,
  );
}

export async function sqliteCompactFeedScanHints(
  deletedIds: (rows: readonly FeedScanHint[]) => readonly string[],
): Promise<boolean> {
  const rows = await readAll<FeedScanHint>('feed_scan_hints');
  if (!rows) return false;
  return deleteIds('feed_scan_hints', 'feed-scan-hint', deletedIds(rows));
}

export function sqliteDeleteAllFeedScanHints(): Promise<boolean> {
  return deleteAll('feed_scan_hints', 'feed-scan-hint');
}

function batch(steps: readonly SqlStep[]): Promise<boolean> {
  return sqliteRecordBatch(ensureEventGraphSchema, steps);
}

function readAll<T>(table: string): Promise<T[] | undefined> {
  return sqliteRecordReadMany<T>(
    ensureEventGraphSchema,
    table,
    '1 = 1',
    [],
    20_000,
  );
}

function deleteByIds(
  table: string,
  ownerKind: CacheLedgerRecord['ownerKind'],
  rows: readonly { readonly id: string }[],
): Promise<boolean> {
  return deleteIds(
    table,
    ownerKind,
    rows.map((row) => row.id),
  );
}

function deleteIds(
  table: string,
  ownerKind: CacheLedgerRecord['ownerKind'],
  ids: readonly string[],
): Promise<boolean> {
  return batch(feedDeleteSteps(table, ownerKind, ids));
}

function deleteAll(
  table: string,
  ownerKind: CacheLedgerRecord['ownerKind'],
): Promise<boolean> {
  return batch(feedDeleteAllSteps(table, ownerKind));
}
