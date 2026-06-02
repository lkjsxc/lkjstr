import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayRoute } from '../../relays/relay-route-types';
import {
  sqlitePutAuthorRelayRoutes,
  sqliteReadAuthorRelayRoutes,
} from '../sqlite-opfs/relay-cache-sqlite';

export async function putAuthorRelayRoutesWithLedger(
  routes: readonly RelayRoute[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  await sqlitePutAuthorRelayRoutes(routes, ledgerRows).catch(() => false);
}

export async function readAuthorRelayRoutesByAuthors(
  authors: readonly string[],
  fallback: readonly RelayRoute[],
): Promise<RelayRoute[]> {
  return (
    (await sqliteReadAuthorRelayRoutes(authors).catch(() => undefined)) ?? [
      ...fallback,
    ]
  );
}
