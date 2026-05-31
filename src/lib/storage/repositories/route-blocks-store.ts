import type { RelayRouteBlock } from '../../relays/relay-route-types';
import { browserDb } from '../browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../safe-storage';

export async function putRelayRouteBlockRow(
  block: RelayRouteBlock,
): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().relayRouteBlocks.put(block));
}

export async function deleteRelayRouteBlockRow(id: string): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().relayRouteBlocks.delete(id));
}

export async function readRecentRelayRouteBlockRows(
  fallback: RelayRouteBlock[],
): Promise<RelayRouteBlock[]> {
  return boundedStorageRead(
    () =>
      browserDb()
        .relayRouteBlocks.orderBy('updatedAt')
        .reverse()
        .limit(500)
        .toArray(),
    fallback,
  );
}
