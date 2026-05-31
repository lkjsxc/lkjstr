import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayRoute } from '../../relays/relay-route-types';
import { browserDb } from '../browser-db';
import { withStorageTransaction } from '../operation/transaction';
import { boundedStorageRead } from '../safe-storage';

export async function putAuthorRelayRoutesWithLedger(
  routes: readonly RelayRoute[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<void> {
  if (routes.length === 0) return;
  await withStorageTransaction({
    mode: 'rw',
    tables: ['authorRelayRoutes', 'cacheLedger'],
    purpose: 'author-route-write',
    run: async (db) => {
      await db.authorRelayRoutes.bulkPut([...routes]);
      await db.cacheLedger.bulkPut([...ledgerRows]);
    },
  });
}

export async function readAuthorRelayRoutesByAuthors(
  authors: readonly string[],
  fallback: readonly RelayRoute[],
): Promise<RelayRoute[]> {
  return boundedStorageRead(
    () =>
      browserDb()
        .authorRelayRoutes.where('authorPubkey')
        .anyOf([...authors])
        .toArray(),
    [...fallback],
  );
}
