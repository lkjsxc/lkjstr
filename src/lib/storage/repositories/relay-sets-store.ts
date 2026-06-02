import type { RelaySet } from '../../relays/relay-types';
import {
  sqlitePutRelaySets,
  sqliteReadRelaySets,
} from '../sqlite-opfs/relay-sets-sqlite';

let memoryRows: RelaySet[] = [];
const startupReadDeadlineMs = 3_000;

export async function readRelaySetRows(
  fallback: RelaySet[],
): Promise<RelaySet[]> {
  if (memoryRows.length > 0 || fallback.length > 0) {
    void refreshMemoryRows();
    return memoryRows.length > 0 ? memoryRows : fallback;
  }
  const rows = await Promise.race([
    sqliteReadRelaySets().catch(() => undefined),
    fallbackAfter(startupReadDeadlineMs, undefined),
  ]);
  memoryRows = rows ?? fallback;
  return memoryRows;
}

export async function putRelaySetRows(
  relaySets: readonly RelaySet[],
): Promise<void> {
  memoryRows = [...relaySets];
  await sqlitePutRelaySets(relaySets).catch(() => false);
}

async function refreshMemoryRows(): Promise<void> {
  const rows = await sqliteReadRelaySets().catch(() => undefined);
  if (rows) memoryRows = rows;
}

function fallbackAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
