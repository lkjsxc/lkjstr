import { browserDb } from '../storage/browser-db';
import type { CacheLedgerRecord } from './cache-ledger-record';

export async function cacheLedgerTargetExists(
  row: CacheLedgerRecord,
): Promise<boolean> {
  const id = row.resourceId;
  if (row.resourceKind === 'nostr-event')
    return Boolean(await browserDb().events.get(id));
  if (row.resourceKind === 'notification-record')
    return Boolean(await browserDb().notifications.get(id));
  if (row.resourceKind === 'feed-cursor')
    return Boolean(await browserDb().feedCursors.get(id));
  if (row.resourceKind === 'coverage-row')
    return Boolean(await browserDb().feedCoverage.get(id));
  if (row.resourceKind === 'scan-hint')
    return Boolean(await browserDb().feedScanHints.get(id));
  if (row.resourceKind === 'relay-summary')
    return Boolean(await browserDb().relayDiagnosticSummaries.get(id));
  if (row.resourceKind === 'relay-info')
    return Boolean(await browserDb().relayInformation.get(id));
  if (row.resourceKind === 'relay-list-suggestion')
    return Boolean(await browserDb().relayListSuggestions.get(id));
  if (row.resourceKind === 'author-relay-route')
    return Boolean(await browserDb().authorRelayRoutes.get(id));
  if (row.resourceKind === 'job-record')
    return Boolean(await browserDb().jobs.get(id));
  if (row.resourceKind === 'tab-state')
    return Boolean(await browserDb().tabStates.get(id));
  return false;
}
