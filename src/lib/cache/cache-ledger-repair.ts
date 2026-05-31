import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import type { CacheLedgerRecord } from './cache-ledger-record';
import { cacheLedgerTargetExists } from './cache-ledger-target';
import { collectRepairRows } from './cache-ledger-repair-rows';

export type CacheLedgerRepairResult = {
  readonly orphanLedgerRowsDeleted: number;
  readonly missingLedgerRowsInserted: number;
  readonly staleLedgerRowsUpdated: number;
  readonly skippedProtectedRows: number;
  readonly startedAt: number;
  readonly finishedAt: number;
};

export async function repairCacheLedger(): Promise<CacheLedgerRepairResult> {
  const startedAt = Date.now();
  if (!indexedDbAvailable()) return emptyRepair(startedAt);
  try {
    const orphanLedgerRowsDeleted = await deleteOrphans();
    const result = await backfillAndUpdate();
    const done = {
      ...result,
      orphanLedgerRowsDeleted,
      startedAt,
      finishedAt: Date.now(),
    };
    await writeRepairMetadata(done);
    return done;
  } catch {
    return emptyRepair(startedAt);
  }
}

export async function cacheLedgerHealth(): Promise<{
  readonly orphanLedgerRows: number;
  readonly missingLedgerRows: number;
}> {
  if (!indexedDbAvailable())
    return { orphanLedgerRows: 0, missingLedgerRows: 0 };
  try {
    const orphanLedgerRows = await countOrphans();
    let missingLedgerRows = 0;
    await collectRepairRows(async (record) => {
      if (!(await browserDb().cacheLedger.get(record.id)))
        missingLedgerRows += 1;
    });
    return { orphanLedgerRows, missingLedgerRows };
  } catch {
    return { orphanLedgerRows: 0, missingLedgerRows: 0 };
  }
}

async function backfillAndUpdate() {
  let missingLedgerRowsInserted = 0;
  let staleLedgerRowsUpdated = 0;
  let skippedProtectedRows = 0;
  const rows: CacheLedgerRecord[] = [];
  await collectRepairRows(async (record) => {
    const existing = await browserDb().cacheLedger.get(record.id);
    if (!existing) {
      missingLedgerRowsInserted += 1;
      rows.push(record);
      return;
    }
    if (existing.protected) {
      skippedProtectedRows += 1;
      return;
    }
    if (staleLedgerRecord(existing, record)) {
      staleLedgerRowsUpdated += 1;
      rows.push({ ...record, protected: existing.protected });
    }
  });
  if (rows.length > 0) await browserDb().cacheLedger.bulkPut(rows);
  return {
    missingLedgerRowsInserted,
    staleLedgerRowsUpdated,
    skippedProtectedRows,
  };
}

async function deleteOrphans(): Promise<number> {
  const orphanIds: string[] = [];
  await browserDb().cacheLedger.each(async (row) => {
    if (!(await cacheLedgerTargetExists(row))) orphanIds.push(row.id);
  });
  if (orphanIds.length > 0) await browserDb().cacheLedger.bulkDelete(orphanIds);
  return orphanIds.length;
}

async function countOrphans(): Promise<number> {
  let count = 0;
  await browserDb().cacheLedger.each(async (row) => {
    if (!(await cacheLedgerTargetExists(row))) count += 1;
  });
  return count;
}

function staleLedgerRecord(
  existing: CacheLedgerRecord,
  next: CacheLedgerRecord,
): boolean {
  return existing.cacheBytes <= 0 || existing.cacheBytes !== next.cacheBytes;
}

function emptyRepair(startedAt: number): CacheLedgerRepairResult {
  return {
    orphanLedgerRowsDeleted: 0,
    missingLedgerRowsInserted: 0,
    staleLedgerRowsUpdated: 0,
    skippedProtectedRows: 0,
    startedAt,
    finishedAt: Date.now(),
  };
}

async function writeRepairMetadata(
  result: CacheLedgerRepairResult,
): Promise<void> {
  try {
    const existing = await browserDb().cacheMeta.get('main');
    if (!existing) return;
    await browserDb().cacheMeta.put({
      ...existing,
      lastRepairResult: result,
      orphanLedgerRows: result.orphanLedgerRowsDeleted,
      missingLedgerRows: result.missingLedgerRowsInserted,
      updatedAt: Date.now(),
    });
  } catch {
    return;
  }
}
