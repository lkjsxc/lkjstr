import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type LedgerInventoryRow = {
  readonly ownerKind: string;
  readonly resourceKind: string;
  readonly rowCount: number;
  readonly estimatedBytes: number;
  readonly prunableBytes: number;
  readonly protectedBytes: number;
};

export async function estimatedPrunableCacheBytes(): Promise<number> {
  if (!indexedDbAvailable()) return 0;
  let total = 0;
  await browserDb().cacheLedger.each((row) => {
    if (!row.protected) total += row.cacheBytes ?? 0;
  });
  return total;
}

export async function estimatedLedgerBytes(): Promise<number> {
  if (!indexedDbAvailable()) return 0;
  let total = 0;
  await browserDb().cacheLedger.each((row) => {
    total += row.cacheBytes ?? 0;
  });
  return total;
}

export async function estimatedEventCacheBytes(): Promise<number> {
  if (!indexedDbAvailable()) return 0;
  let total = 0;
  await browserDb()
    .cacheLedger.where('ownerKind')
    .equals('event')
    .each((row) => {
      total += row.cacheBytes ?? 0;
    });
  return total;
}

export async function estimatedLedgerBytesByOwner(): Promise<
  LedgerInventoryRow[]
> {
  if (!indexedDbAvailable()) return [];
  const rows = new Map<string, LedgerInventoryRow>();
  await browserDb().cacheLedger.each((row) => mergeLedgerRow(rows, row));
  return [...rows.values()].sort(
    (a, b) => b.estimatedBytes - a.estimatedBytes,
  );
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
    estimatedBytes: 0,
    prunableBytes: 0,
    protectedBytes: 0,
  };
  const bytes = row.cacheBytes ?? 0;
  rows.set(key, {
    ...current,
    rowCount: current.rowCount + 1,
    estimatedBytes: current.estimatedBytes + bytes,
    prunableBytes: current.prunableBytes + (row.protected ? 0 : bytes),
    protectedBytes: current.protectedBytes + (row.protected ? bytes : 0),
  });
}
