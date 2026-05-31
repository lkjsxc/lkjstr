import { browserDb } from '../storage/browser-db';
import type { CacheLedgerRecord } from './cache-ledger-record';

export type CacheLedgerTargetState = 'present' | 'missing' | 'unavailable';

export async function cacheLedgerTargetExists(
  row: CacheLedgerRecord,
): Promise<boolean> {
  const state = await cacheLedgerTargetState(row);
  return state !== 'missing';
}

export async function cacheLedgerTargetState(
  row: CacheLedgerRecord,
): Promise<CacheLedgerTargetState> {
  const id = row.resourceId;
  try {
    if (row.resourceKind === 'nostr-event')
      return found(await browserDb().events.get(id));
    if (row.resourceKind === 'notification-record')
      return found(await browserDb().notifications.get(id));
    if (row.resourceKind === 'feed-cursor')
      return found(await browserDb().feedCursors.get(id));
    if (row.resourceKind === 'coverage-row')
      return found(await browserDb().feedCoverage.get(id));
    if (row.resourceKind === 'scan-hint')
      return found(await browserDb().feedScanHints.get(id));
    if (row.resourceKind === 'relay-summary')
      return found(await browserDb().relayDiagnosticSummaries.get(id));
    if (row.resourceKind === 'relay-info')
      return found(await browserDb().relayInformation.get(id));
    if (row.resourceKind === 'relay-list-suggestion')
      return found(await browserDb().relayListSuggestions.get(id));
    if (row.resourceKind === 'author-relay-route')
      return found(await browserDb().authorRelayRoutes.get(id));
    if (row.resourceKind === 'job-record')
      return found(await browserDb().jobs.get(id));
    if (row.resourceKind === 'tab-state')
      return found(await browserDb().tabStates.get(id));
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function found(row: unknown): CacheLedgerTargetState {
  return row ? 'present' : 'missing';
}
