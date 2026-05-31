import { browserDb } from '../storage/browser-db';
import { indexedDbAvailable } from '../storage/safe-storage';
import { cacheByteSizeForEvent } from './cache-byte-size';
import { eventLedgerRecord } from './event-ledger';
import type { CacheLedgerRecord } from './cache-ledger-record';
import { cacheLedgerTargetExists } from './cache-ledger-target';
import { notificationLedgerRecord } from '../notifications/notification-ledger';
import {
  feedCoverageLedgerRecord,
  feedCursorLedgerRecord,
  feedScanHintLedgerRecord,
} from '../events/feed-cache-ledger';
import { jobLedgerRecord } from '../jobs/job-ledger';
import {
  relayInfoLedgerRecord,
  relayRouteLedgerRecord,
  relaySummaryLedgerRecord,
  relaySuggestionLedgerRecord,
} from '../relays/relay-cache-ledger';

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
}

export async function cacheLedgerHealth(): Promise<{
  readonly orphanLedgerRows: number;
  readonly missingLedgerRows: number;
}> {
  if (!indexedDbAvailable())
    return { orphanLedgerRows: 0, missingLedgerRows: 0 };
  const orphanLedgerRows = await countOrphans();
  let missingLedgerRows = 0;
  await collectRepairRows(async (record) => {
    if (!(await browserDb().cacheLedger.get(record.id))) missingLedgerRows += 1;
  });
  return { orphanLedgerRows, missingLedgerRows };
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

async function collectRepairRows(
  visit: (record: CacheLedgerRecord) => Promise<void>,
): Promise<void> {
  await browserDb().events.each(async (event) => {
    const receipts = await browserDb()
      .eventRelays.where('eventId')
      .equals(event.id)
      .toArray();
    const tags = await browserDb()
      .eventTags.where('eventId')
      .equals(event.id)
      .toArray();
    const draft = eventLedgerRecord(event, tags);
    await visit({
      ...draft,
      cacheBytes: cacheByteSizeForEvent(event, receipts, tags, draft),
    });
  });
  await browserDb().notifications.each((row) =>
    visit(notificationLedgerRecord(row)),
  );
  await browserDb().feedCursors.each((row) =>
    visit(feedCursorLedgerRecord(row)),
  );
  await browserDb().feedCoverage.each((row) =>
    visit(feedCoverageLedgerRecord(row)),
  );
  await browserDb().feedScanHints.each((row) =>
    visit(feedScanHintLedgerRecord(row)),
  );
  await browserDb().jobs.each((row) => visit(jobLedgerRecord(row)));
  await browserDb().relayDiagnosticSummaries.each((row) =>
    visit(relaySummaryLedgerRecord(row)),
  );
  await browserDb().relayInformation.each((row) =>
    visit(relayInfoLedgerRecord(row)),
  );
  await browserDb().relayListSuggestions.each((row) =>
    visit(relaySuggestionLedgerRecord(row)),
  );
  await browserDb().authorRelayRoutes.each((row) =>
    visit(relayRouteLedgerRecord(row)),
  );
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
  const existing = await browserDb().cacheMeta.get('main');
  if (!existing) return;
  await browserDb().cacheMeta.put({
    ...existing,
    lastRepairResult: result,
    orphanLedgerRows: result.orphanLedgerRowsDeleted,
    missingLedgerRows: result.missingLedgerRowsInserted,
    updatedAt: Date.now(),
  });
}
