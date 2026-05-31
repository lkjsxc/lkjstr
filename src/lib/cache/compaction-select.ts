import { browserDb } from '../storage/browser-db';
import { boundedStorageRead } from '../storage/safe-storage';
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
  return boundedStorageRead(async () => {
    const selectedRows: CacheLedgerRecord[] = [];
    let scannedRows = 0;
    let skippedDurablyProtected = 0;
    let skippedDynamicallyProtected = 0;
    await browserDb()
      .cacheLedger.orderBy('score')
      .each((row: CacheLedgerRecord) => {
        scannedRows += 1;
        if (selectedRows.length >= needed) return false;
        if (row.protected) {
          skippedDurablyProtected += 1;
          return;
        }
        if (protectedIds.has(row.id) || protectedIds.has(row.resourceId)) {
          skippedDynamicallyProtected += 1;
          return;
        }
        selectedRows.push(row);
      });
    return {
      selectedRows,
      scannedRows,
      skippedDurablyProtected,
      skippedDynamicallyProtected,
      selectedBytes: selectedRows.reduce(
        (sum, row) => sum + (row.cacheBytes ?? 0),
        0,
      ),
    };
  }, emptyPruneSelection());
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
