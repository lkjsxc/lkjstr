import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayDiagnosticSummary } from '../../relays/relay-diagnostic-summary';
import { browserDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function putRelayDiagnosticSummaryWithLedger(
  summary: RelayDiagnosticSummary,
  ledgerRow: CacheLedgerRecord,
): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['relayDiagnosticSummaries', 'cacheLedger'],
    purpose: 'relay-diagnostic-write',
    run: async (db) => {
      await db.relayDiagnosticSummaries.put(summary);
      await db.cacheLedger.put(ledgerRow);
    },
  });
}

export async function putRelayDiagnosticSummariesWithLedger(
  summaries: readonly RelayDiagnosticSummary[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  if (summaries.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['relayDiagnosticSummaries', 'cacheLedger'],
    purpose: 'relay-diagnostic-write',
    run: async (db) => {
      await db.relayDiagnosticSummaries.bulkPut([...summaries]);
      await db.cacheLedger.bulkPut([...ledgerRows]);
    },
  });
}

export async function readRelayDiagnosticSummaryRow(
  relayUrl: string,
): Promise<RelayDiagnosticSummary | undefined> {
  return boundedStorageRead(
    () => browserDb().relayDiagnosticSummaries.get(relayUrl),
    undefined,
  );
}

export async function readRecentRelayDiagnosticSummaryRows(
  limit: number,
  fallback: readonly RelayDiagnosticSummary[],
): Promise<RelayDiagnosticSummary[]> {
  return boundedStorageRead(
    () =>
      browserDb()
        .relayDiagnosticSummaries.orderBy('updatedAt')
        .reverse()
        .limit(limit)
        .toArray(),
    [...fallback],
  );
}
