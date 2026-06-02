import { sqliteReadCacheLedgerRows } from '../storage/sqlite-opfs/cache-ledger-sqlite';
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

export type PruneSelectionSummary = {
  readonly selectedRows: readonly CacheLedgerRecord[];
  readonly scannedRows: number;
  readonly skippedDurablyProtected: number;
  readonly skippedDynamicallyProtected: number;
  readonly selectedBytes: number;
};

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
  return [
    ...(await lowestScorePruneSelection(needed, protectedIds)).selectedRows,
  ];
}

export async function lowestScorePruneSelection(
  needed: number,
  protectedIds: Set<string>,
): Promise<PruneSelectionSummary> {
  const rows = await sqliteReadCacheLedgerRows().catch(() => undefined);
  if (!rows) return emptyPruneSelection();
  const selectedRows: CacheLedgerRecord[] = [];
  let skippedDurablyProtected = 0;
  let skippedDynamicallyProtected = 0;
  for (const row of rows.sort(compareCacheLedgerRows)) {
    if (selectedRows.length >= needed) break;
    if (row.protected) {
      skippedDurablyProtected += 1;
      continue;
    }
    if (protectedIds.has(row.id) || protectedIds.has(row.resourceId)) {
      skippedDynamicallyProtected += 1;
      continue;
    }
    selectedRows.push(row);
  }
  return {
    selectedRows,
    scannedRows: rows.length,
    skippedDurablyProtected,
    skippedDynamicallyProtected,
    selectedBytes: selectedRows.reduce(
      (sum, row) => sum + (row.cacheBytes ?? 0),
      0,
    ),
  };
}

export function emptyPruneSelection(): PruneSelectionSummary {
  return {
    selectedRows: [],
    scannedRows: 0,
    skippedDurablyProtected: 0,
    skippedDynamicallyProtected: 0,
    selectedBytes: 0,
  };
}
