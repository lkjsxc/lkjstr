import { browserDb } from '../storage/browser-db';
import { visitStorageRows } from '../storage/ledger/table-scan';
import { cacheByteSizeForEvent } from './cache-byte-size';
import type { CacheLedgerRecord } from './cache-ledger-record';
import { eventLedgerRecord } from './event-ledger';
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
import { tabStateLedgerRecord } from '../workspace/tab-state-ledger';

export async function collectRepairRows(
  visit: (record: CacheLedgerRecord) => Promise<void>,
): Promise<void> {
  const db = browserDb();
  await collectEventRows(visit);
  await visitStorageRows(db.notifications, async (row) =>
    visit(notificationLedgerRecord(row)),
  );
  await visitStorageRows(db.feedCursors, async (row) =>
    visit(feedCursorLedgerRecord(row)),
  );
  await visitStorageRows(db.feedCoverage, async (row) =>
    visit(feedCoverageLedgerRecord(row)),
  );
  await visitStorageRows(db.feedScanHints, async (row) =>
    visit(feedScanHintLedgerRecord(row)),
  );
  await visitStorageRows(db.jobs, async (row) => visit(jobLedgerRecord(row)));
  await visitStorageRows(db.relayDiagnosticSummaries, async (row) =>
    visit(relaySummaryLedgerRecord(row)),
  );
  await visitStorageRows(db.relayInformation, async (row) =>
    visit(relayInfoLedgerRecord(row)),
  );
  await visitStorageRows(db.relayListSuggestions, async (row) =>
    visit(relaySuggestionLedgerRecord(row)),
  );
  await visitStorageRows(db.authorRelayRoutes, async (row) =>
    visit(relayRouteLedgerRecord(row)),
  );
  await visitStorageRows(db.tabStates, async (row) =>
    visit(tabStateLedgerRecord(row)),
  );
}

async function collectEventRows(
  visit: (record: CacheLedgerRecord) => Promise<void>,
): Promise<void> {
  const db = browserDb();
  await visitStorageRows(db.events, async (event) => {
    const receipts = await readRows(() =>
      db.eventRelays.where('eventId').equals(event.id).toArray(),
    );
    const tags = await readRows(() =>
      db.eventTags.where('eventId').equals(event.id).toArray(),
    );
    const draft = eventLedgerRecord(event, tags);
    await visit({
      ...draft,
      cacheBytes: cacheByteSizeForEvent(event, receipts, tags, draft),
    });
  });
}

async function readRows<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch {
    return [];
  }
}
