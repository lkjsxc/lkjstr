import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayListSuggestionRecord } from '../../relays/relay-list-suggestions';
import { browserDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function putRelayListSuggestionRowsWithLedger(
  records: readonly RelayListSuggestionRecord[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  if (records.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['relayListSuggestions', 'cacheLedger'],
    purpose: 'relay-suggestion-write',
    run: async (db) => {
      await db.relayListSuggestions.bulkPut([...records]);
      await db.cacheLedger.bulkPut([...ledgerRows]);
    },
  });
}

export async function readRelayListSuggestionRowsForAccount(
  accountPubkey: string,
  fallback: readonly RelayListSuggestionRecord[],
): Promise<RelayListSuggestionRecord[]> {
  return boundedStorageRead(
    () =>
      browserDb()
        .relayListSuggestions.where('accountPubkey')
        .equals(accountPubkey)
        .toArray(),
    [...fallback],
  );
}
