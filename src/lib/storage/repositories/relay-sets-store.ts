import type { RelaySet } from '../../relays/relay-types';
import {
  sqlitePutRelaySets,
  sqliteReadRelaySets,
} from '../sqlite-opfs/relay-sets-sqlite';

let memoryRows: RelaySet[] = [];

export async function readRelaySetRows(
  fallback: RelaySet[],
): Promise<RelaySet[]> {
  const rows = await sqliteReadRelaySets().catch(() => undefined);
  memoryRows = rows ?? fallback;
  return memoryRows;
}

export async function putRelaySetRows(
  relaySets: readonly RelaySet[],
): Promise<void> {
  memoryRows = [...relaySets];
  await sqlitePutRelaySets(relaySets).catch(() => false);
}
