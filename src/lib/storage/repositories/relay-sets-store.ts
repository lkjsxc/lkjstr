import type { RelaySet } from '../../relays/relay-types';
import {
  sqlitePutRelaySets,
  sqliteReadRelaySets,
} from '../sqlite-opfs/relay-sets-sqlite';
import { protectedStorageStateFromError } from '../protected-storage-state';

let memoryRows: RelaySet[] = [];

export async function readRelaySetRows(
  fallback: RelaySet[],
): Promise<RelaySet[]> {
  if (memoryRows.length > 0 || fallback.length > 0) {
    void refreshMemoryRows();
    return memoryRows.length > 0 ? memoryRows : fallback;
  }
  const rows = await sqliteReadRelaySets().catch(undefinedUnlessProtected);
  memoryRows = rows ?? fallback;
  return memoryRows;
}

export async function putRelaySetRows(
  relaySets: readonly RelaySet[],
): Promise<void> {
  memoryRows = [...relaySets];
  await sqlitePutRelaySets(relaySets).catch(undefinedUnlessProtected);
}

async function refreshMemoryRows(): Promise<void> {
  const rows = await sqliteReadRelaySets().catch(() => undefined);
  if (rows) memoryRows = rows;
}

function undefinedUnlessProtected(error: unknown): undefined {
  if (protectedStorageStateFromError(error)) throw error;
  return undefined;
}
