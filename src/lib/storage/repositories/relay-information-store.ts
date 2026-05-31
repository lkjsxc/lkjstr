import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayInformationRecord } from '../../relays/relay-info-types';
import { browserDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function putRelayInformationWithLedger(
  record: RelayInformationRecord,
  ledgerRow: CacheLedgerRecord,
): Promise<void> {
  await withStorageTransaction({
    mode: 'rw',
    tables: ['relayInformation', 'cacheLedger'],
    purpose: 'relay-information-write',
    run: async (db) => {
      await db.relayInformation.put(record);
      await db.cacheLedger.put(ledgerRow);
    },
  });
}

export async function readRelayInformationRow(
  relayUrl: string,
): Promise<RelayInformationRecord | undefined> {
  return boundedStorageRead(
    () => browserDb().relayInformation.get(relayUrl),
    undefined,
  );
}

export async function readRecentRelayInformationRows(
  fallback: readonly RelayInformationRecord[],
): Promise<RelayInformationRecord[]> {
  return boundedStorageRead(
    () =>
      browserDb()
        .relayInformation.orderBy('fetchedAt')
        .reverse()
        .limit(500)
        .toArray(),
    [...fallback],
  );
}
