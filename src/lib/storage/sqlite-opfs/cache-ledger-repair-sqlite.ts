import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import { ensureEventGraphSchema } from './event-schema';
import {
  ensureCacheLedgerSchema,
  sqlitePutCacheMeta,
  sqliteReadCacheMeta,
} from './cache-ledger-sqlite';
import {
  collectSqliteRepairRows,
  type RepairRowProgress,
} from './cache-ledger-repair-rows-sqlite';
import {
  deleteSqliteLedgerIds,
  executeSqliteStorage,
  flushSqliteLedgerRows,
  readSqliteLedgerRecord,
  visitSqliteLedgerRows,
} from './cache-ledger-repair-ledger-sqlite';
import { sqliteCacheLedgerTargetState } from './cache-ledger-target-sqlite';

const CHUNK_LIMIT = 250;
const DELETE_BATCH_SIZE = 100;

export type CacheLedgerRepairResult = {
  readonly orphanLedgerRowsDeleted: number;
  readonly missingLedgerRowsInserted: number;
  readonly staleLedgerRowsUpdated: number;
  readonly skippedProtectedRows: number;
  readonly unownedCacheRowsDeleted: number;
  readonly legacyStorageDeleted: number;
  readonly unavailableTargetsSkipped: number;
  readonly scannedResourceRows: number;
  readonly scannedLedgerRows: number;
  readonly startedAt: number;
  readonly finishedAt: number;
};

export async function sqliteRepairCacheLedger(): Promise<CacheLedgerRepairResult> {
  const startedAt = Date.now();
  const progress = emptyRepair(startedAt);
  try {
    progress.orphanLedgerRowsDeleted = await deleteOrphans(progress);
    const rows = await backfillAndUpdate(progress);
    progress.missingLedgerRowsInserted = rows.missingLedgerRowsInserted;
    progress.staleLedgerRowsUpdated = rows.staleLedgerRowsUpdated;
    progress.unownedCacheRowsDeleted = await deleteUnownedCacheRows();
    progress.finishedAt = Date.now();
    await writeRepairMetadata(progress);
    return progress;
  } catch {
    return emptyRepair(startedAt);
  }
}

export async function sqliteCacheLedgerHealth(): Promise<{
  readonly orphanLedgerRows: number;
  readonly missingLedgerRows: number;
  readonly unavailableTargets: number;
}> {
  const unavailable = { count: 0 };
  const [orphanLedgerRows, missing] = await Promise.all([
    countOrphans(unavailable),
    countMissingRows(),
  ]).catch(() => [0, { missingLedgerRows: 0, unavailableTargets: 1 }] as const);
  return {
    orphanLedgerRows,
    missingLedgerRows: missing.missingLedgerRows,
    unavailableTargets: unavailable.count + missing.unavailableTargets,
  };
}

async function backfillAndUpdate(progress: MutableRepair) {
  const pending: CacheLedgerRecord[] = [];
  let missingLedgerRowsInserted = 0;
  let staleLedgerRowsUpdated = 0;
  const rowProgress = await collectSqliteRepairRows(async (record) => {
    const existing = await readSqliteLedgerRecord(record.id);
    if (!existing) {
      pending.push(record);
      missingLedgerRowsInserted += 1;
    } else if (existing.protected) {
      progress.skippedProtectedRows += 1;
    } else if (staleLedgerRecord(existing, record)) {
      pending.push({ ...record, protected: existing.protected });
      staleLedgerRowsUpdated += 1;
    }
    if (pending.length >= CHUNK_LIMIT) await flushSqliteLedgerRows(pending);
  }, CHUNK_LIMIT);
  mergeRowProgress(progress, rowProgress);
  await flushSqliteLedgerRows(pending);
  return { missingLedgerRowsInserted, staleLedgerRowsUpdated };
}

async function deleteOrphans(progress: MutableRepair): Promise<number> {
  let deleted = 0;
  const pending: string[] = [];
  await visitSqliteLedgerRows(CHUNK_LIMIT, async (row) => {
    progress.scannedLedgerRows += 1;
    const state = await sqliteCacheLedgerTargetState(row);
    if (state === 'unavailable') progress.unavailableTargetsSkipped += 1;
    if (state !== 'missing') return;
    if (row.protected) {
      progress.skippedProtectedRows += 1;
      return;
    }
    pending.push(row.id);
    deleted += 1;
    if (pending.length >= DELETE_BATCH_SIZE)
      await deleteSqliteLedgerIds(pending);
  });
  await deleteSqliteLedgerIds(pending);
  return deleted;
}

async function countOrphans(unavailable: { count: number }): Promise<number> {
  let count = 0;
  await visitSqliteLedgerRows(CHUNK_LIMIT, async (row) => {
    const state = await sqliteCacheLedgerTargetState(row);
    if (state === 'missing') count += 1;
    if (state === 'unavailable') unavailable.count += 1;
  });
  return count;
}

async function countMissingRows() {
  let missingLedgerRows = 0;
  const progress = await collectSqliteRepairRows(async (record) => {
    if (!(await readSqliteLedgerRecord(record.id))) missingLedgerRows += 1;
  }, CHUNK_LIMIT);
  return { missingLedgerRows, unavailableTargets: progress.unavailableTargets };
}

async function deleteUnownedCacheRows(): Promise<number> {
  if (!(await ensureEventGraphSchema())) return 0;
  const relays = await executeSqliteStorage(
    'DELETE FROM event_relays WHERE event_id NOT IN (SELECT id FROM events);',
  );
  const tags = await executeSqliteStorage(
    'DELETE FROM event_tags WHERE event_id NOT IN (SELECT id FROM events);',
  );
  return relays + tags;
}

async function writeRepairMetadata(
  result: CacheLedgerRepairResult,
): Promise<void> {
  if (!(await ensureCacheLedgerSchema())) return;
  const existing = await sqliteReadCacheMeta('main').catch(() => undefined);
  if (!existing) return;
  await sqlitePutCacheMeta({
    ...existing,
    lastRepairResult: result,
    orphanLedgerRows: result.orphanLedgerRowsDeleted,
    missingLedgerRows: result.missingLedgerRowsInserted,
    updatedAt: Date.now(),
  });
}

function staleLedgerRecord(
  existing: CacheLedgerRecord,
  next: CacheLedgerRecord,
): boolean {
  return existing.cacheBytes <= 0 || existing.cacheBytes !== next.cacheBytes;
}

function mergeRowProgress(
  target: MutableRepair,
  progress: RepairRowProgress,
): void {
  target.scannedResourceRows += progress.scannedResources;
  target.unavailableTargetsSkipped += progress.unavailableTargets;
}

type MutableRepair = {
  -readonly [Key in keyof CacheLedgerRepairResult]: CacheLedgerRepairResult[Key];
};

function emptyRepair(startedAt: number): MutableRepair {
  return {
    orphanLedgerRowsDeleted: 0,
    missingLedgerRowsInserted: 0,
    staleLedgerRowsUpdated: 0,
    skippedProtectedRows: 0,
    unownedCacheRowsDeleted: 0,
    legacyStorageDeleted: 0,
    unavailableTargetsSkipped: 0,
    scannedResourceRows: 0,
    scannedLedgerRows: 0,
    startedAt,
    finishedAt: Date.now(),
  };
}
