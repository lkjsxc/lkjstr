import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayDiagnosticSummary } from '../../relays/relay-diagnostic-summary';
import {
  sqlitePutRelayDiagnosticSummaries,
  sqliteReadRecentRelayDiagnosticSummaries,
  sqliteReadRelayDiagnosticSummary,
} from '../sqlite-opfs/relay-cache-sqlite';

export async function putRelayDiagnosticSummaryWithLedger(
  summary: RelayDiagnosticSummary,
  ledgerRow: CacheLedgerRecord,
): Promise<void> {
  await sqlitePutRelayDiagnosticSummaries([summary], [ledgerRow]).catch(
    () => false,
  );
}

export async function putRelayDiagnosticSummariesWithLedger(
  summaries: readonly RelayDiagnosticSummary[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  await sqlitePutRelayDiagnosticSummaries(summaries, ledgerRows).catch(
    () => false,
  );
}

export async function readRelayDiagnosticSummaryRow(
  relayUrl: string,
): Promise<RelayDiagnosticSummary | undefined> {
  return sqliteReadRelayDiagnosticSummary(relayUrl).catch(() => undefined);
}

export async function readRecentRelayDiagnosticSummaryRows(
  limit: number,
  fallback: readonly RelayDiagnosticSummary[],
): Promise<RelayDiagnosticSummary[]> {
  return (
    (await sqliteReadRecentRelayDiagnosticSummaries(limit).catch(
      () => undefined,
    )) ?? [...fallback]
  );
}
