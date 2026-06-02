import type { RelayRouteBlock } from '../../relays/relay-route-types';
import {
  sqliteDeleteRelayRouteBlock,
  sqlitePutRelayRouteBlock,
  sqliteReadRecentRelayRouteBlocks,
} from '../sqlite-opfs/relay-cache-sqlite';

export async function putRelayRouteBlockRow(
  block: RelayRouteBlock,
): Promise<void> {
  await sqlitePutRelayRouteBlock(block).catch(() => false);
}

export async function deleteRelayRouteBlockRow(id: string): Promise<void> {
  await sqliteDeleteRelayRouteBlock(id).catch(() => false);
}

export async function readRecentRelayRouteBlockRows(
  fallback: RelayRouteBlock[],
): Promise<RelayRouteBlock[]> {
  return (
    (await sqliteReadRecentRelayRouteBlocks().catch(() => undefined)) ??
    fallback
  );
}
