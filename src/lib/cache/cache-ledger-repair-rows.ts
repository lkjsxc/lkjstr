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
  for (const row of await readRows(() => browserDb().notifications.toArray()))
    await visit(notificationLedgerRecord(row));
  for (const row of await readRows(() => browserDb().feedCursors.toArray()))
    await visit(feedCursorLedgerRecord(row));
  for (const row of await readRows(() => browserDb().feedCoverage.toArray()))
    await visit(feedCoverageLedgerRecord(row));
  for (const row of await readRows(() => browserDb().feedScanHints.toArray()))
    await visit(feedScanHintLedgerRecord(row));
  for (const row of await readRows(() => browserDb().jobs.toArray()))
    await visit(jobLedgerRecord(row));
  for (const row of await readRows(() =>
    browserDb().relayDiagnosticSummaries.toArray(),
  ))
    await visit(relaySummaryLedgerRecord(row));
  for (const row of await readRows(() =>
    browserDb().relayInformation.toArray(),
  ))
    await visit(relayInfoLedgerRecord(row));
  for (const row of await readRows(() =>
    browserDb().relayListSuggestions.toArray(),
  ))
    await visit(relaySuggestionLedgerRecord(row));
  for (const row of await readRows(() =>
    browserDb().authorRelayRoutes.toArray(),
  ))
    await visit(relayRouteLedgerRecord(row));
  for (const row of await readRows(() => browserDb().tabStates.toArray()))
    await visit(tabStateLedgerRecord(row));
}

async function collectEventRows(
  visit: (record: CacheLedgerRecord) => Promise<void>,
): Promise<void> {
  const events = await readRows(() => browserDb().events.toArray());
  for (const event of events) {
    const receipts = await readRows(() =>
      browserDb().eventRelays.where('eventId').equals(event.id).toArray(),
    );
    const tags = await readRows(() =>
      browserDb().eventTags.where('eventId').equals(event.id).toArray(),
    );
    const draft = eventLedgerRecord(event, tags);
    await visit({
      ...draft,
      cacheBytes: cacheByteSizeForEvent(event, receipts, tags, draft),
    });
  }
}

async function readRows<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch {
    return [];
  }
}
