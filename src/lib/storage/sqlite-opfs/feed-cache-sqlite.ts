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
import type { SqlScalar, SqlStep } from './types';

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

export async function sqliteReadFeedCoverageRowsForRequirements(
  feedKey: string,
  requirements: readonly CoverageRequirementRow[],
): Promise<FeedCoverage[] | undefined> {
  const rows = await Promise.all(
    requirements.map((requirement) =>
      readCoverageRequirement(feedKey, requirement),
    ),
  );
  if (rows.some((row) => !row)) return undefined;
  return uniqueRows(rows.flatMap((row) => row ?? []));
}

export type CoverageRequirementRow = {
  readonly groupKey: string;
  readonly relayUrl: string;
  readonly filterKey: string;
  readonly since?: number;
  readonly until?: number;
};

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

function readCoverageRequirement(
  feedKey: string,
  requirement: CoverageRequirementRow,
): Promise<FeedCoverage[] | undefined> {
  if (requirement.since === undefined || requirement.until === undefined)
    return Promise.resolve([]);
  return sqliteRecordReadMany<FeedCoverage>(
    ensureEventGraphSchema,
    'feed_coverage',
    'feed_key = ?1 AND group_key = ?2 AND relay_url = ?3 AND filter_key = ?4 AND status = ?5 AND since < ?6 AND until > ?7 ORDER BY since ASC, until ASC',
    coverageRequirementParams(feedKey, requirement),
    500,
  );
}

function coverageRequirementParams(
  feedKey: string,
  requirement: CoverageRequirementRow,
): readonly SqlScalar[] {
  return [
    feedKey,
    requirement.groupKey,
    requirement.relayUrl,
    requirement.filterKey,
    'complete',
    requirement.until ?? 0,
    requirement.since ?? 0,
  ];
}

function uniqueRows(rows: readonly FeedCoverage[]): FeedCoverage[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
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
