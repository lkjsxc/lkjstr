import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayInformationRecord } from '../../relays/relay-info-types';
import {
  sqlitePutRelayInformation,
  sqliteReadRecentRelayInformation,
  sqliteReadRelayInformation,
} from '../sqlite-opfs/relay-cache-sqlite';

export async function putRelayInformationWithLedger(
  record: RelayInformationRecord,
  ledgerRow: CacheLedgerRecord,
): Promise<void> {
  await sqlitePutRelayInformation(record, ledgerRow).catch(() => false);
}

export async function readRelayInformationRow(
  relayUrl: string,
): Promise<RelayInformationRecord | undefined> {
  return sqliteReadRelayInformation(relayUrl).catch(() => undefined);
}

export async function readRecentRelayInformationRows(
  fallback: readonly RelayInformationRecord[],
): Promise<RelayInformationRecord[]> {
  return (
    (await sqliteReadRecentRelayInformation().catch(() => undefined)) ?? [
      ...fallback,
    ]
  );
}
