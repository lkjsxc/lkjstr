import { browserDb } from '../storage/browser-db';
import type { CacheLedgerRecord } from './cache-ledger-record';
import { compareCacheLedgerRows } from './cache-ledger-score';

export function selectPruneIds(
  rows: readonly CacheLedgerRecord[],
  protectedIds: ReadonlySet<string>,
  needed: number,
): string[] {
  return selectPruneRows(rows, protectedIds, needed).map(
    (row) => row.resourceId,
  );
}

export function selectPruneRows(
  rows: readonly CacheLedgerRecord[],
  protectedIds: ReadonlySet<string>,
  needed: number,
): CacheLedgerRecord[] {
  return rows
    .filter((row) => isPrunablePriorityRow(row, protectedIds))
    .sort(compareCacheLedgerRows)
    .slice(0, needed);
}

export function isPrunablePriorityRow(
  row: CacheLedgerRecord,
  protectedIds: ReadonlySet<string>,
): boolean {
  return (
    !protectedIds.has(row.id) &&
    !protectedIds.has(row.resourceId) &&
    !row.protected
  );
}

export async function lowestScorePruneRows(
  needed: number,
  protectedIds: Set<string>,
): Promise<CacheLedgerRecord[]> {
  const rows: CacheLedgerRecord[] = [];
  await browserDb()
    .cacheLedger.orderBy('score')
    .each((row: CacheLedgerRecord) => {
      if (rows.length >= needed) return false;
      if (isPrunablePriorityRow(row, protectedIds)) rows.push(row);
    });
  return rows;
}
