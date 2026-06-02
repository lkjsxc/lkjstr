import { sqliteReadCacheLedgerRows } from '../storage/sqlite-opfs/cache-ledger-sqlite';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type LedgerInventoryRow = {
  readonly ownerKind: string;
  readonly resourceKind: string;
  readonly rowCount: number;
  readonly prunableRows: number;
  readonly protectedRows: number;
  readonly estimatedBytes: number;
  readonly prunableBytes: number;
  readonly protectedBytes: number;
};

export async function estimatedPrunableCacheBytes(): Promise<number> {
  return ledgerRows().then((rows) =>
    rows.reduce((sum, row) => sum + (row.protected ? 0 : row.cacheBytes), 0),
  );
}

export async function estimatedLedgerBytes(): Promise<number> {
  return ledgerRows().then((rows) =>
    rows.reduce((sum, row) => sum + row.cacheBytes, 0),
  );
}

export async function estimatedEventCacheBytes(): Promise<number> {
  return ledgerRows().then((rows) =>
    rows
      .filter((row) => row.ownerKind === 'event')
      .reduce((sum, row) => sum + row.cacheBytes, 0),
  );
}

export async function estimatedLedgerBytesByOwner(): Promise<
  LedgerInventoryRow[]
> {
  const rows = new Map<string, LedgerInventoryRow>();
  for (const row of await ledgerRows()) mergeLedgerRow(rows, row);
  return [...rows.values()].sort(
    (left, right) => right.estimatedBytes - left.estimatedBytes,
  );
}

async function ledgerRows(): Promise<CacheLedgerRecord[]> {
  return (await sqliteReadCacheLedgerRows().catch(() => undefined)) ?? [];
}

function mergeLedgerRow(
  rows: Map<string, LedgerInventoryRow>,
  row: CacheLedgerRecord,
): void {
  const key = `${row.ownerKind}:${row.resourceKind}`;
  const current = rows.get(key) ?? {
    ownerKind: row.ownerKind,
    resourceKind: row.resourceKind,
    rowCount: 0,
    prunableRows: 0,
    protectedRows: 0,
    estimatedBytes: 0,
    prunableBytes: 0,
    protectedBytes: 0,
  };
  const bytes = row.cacheBytes ?? 0;
  rows.set(key, {
    ...current,
    rowCount: current.rowCount + 1,
    prunableRows: current.prunableRows + (row.protected ? 0 : 1),
    protectedRows: current.protectedRows + (row.protected ? 1 : 0),
    estimatedBytes: current.estimatedBytes + bytes,
    prunableBytes: current.prunableBytes + (row.protected ? 0 : bytes),
    protectedBytes: current.protectedBytes + (row.protected ? bytes : 0),
  });
}
