import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayListSuggestionRecord } from '../../relays/relay-list-suggestions';
import {
  sqlitePutRelayListSuggestions,
  sqliteReadRelayListSuggestions,
} from '../sqlite-opfs/relay-cache-sqlite';

export async function putRelayListSuggestionRowsWithLedger(
  records: readonly RelayListSuggestionRecord[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  await sqlitePutRelayListSuggestions(records, ledgerRows).catch(() => false);
}

export async function readRelayListSuggestionRowsForAccount(
  accountPubkey: string,
  fallback: readonly RelayListSuggestionRecord[],
): Promise<RelayListSuggestionRecord[]> {
  return (
    (await sqliteReadRelayListSuggestions(accountPubkey).catch(
      () => undefined,
    )) ?? [...fallback]
  );
}
