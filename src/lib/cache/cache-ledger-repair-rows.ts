import { browserDb } from '../storage/browser-db';
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
  await collectEventRows(visit);
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
  await browserDb().tabStates.each((row) => visit(tabStateLedgerRecord(row)));
}

async function collectEventRows(
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
}
