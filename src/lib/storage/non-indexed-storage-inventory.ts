import { encodedJsonBytes } from '../cache/cache-byte-size';
import type { StorageInventoryRow } from './storage-inventory';

const cacheInventoryDeadlineMs = 500;

export async function nonIndexedStorageInventory(): Promise<
  StorageInventoryRow[]
> {
  return [localStorageInventory(), ...(await cacheStorageInventory())];
}

function localStorageInventory(): StorageInventoryRow {
  const local = globalThis.localStorage;
  if (!local) return unsupportedRow('localStorage');
  let estimatedBytes = 0;
  for (let index = 0; index < local.length; index += 1) {
    const key = local.key(index);
    if (!key) continue;
    estimatedBytes += encodedJsonBytes(key) + encodedJsonBytes(local.getItem(key));
  }
  return {
    table: 'localStorage',
    group: 'non-indexed',
    rowCount: local.length,
    estimatedBytes,
    status: 'exact',
  };
}

async function cacheStorageInventory(): Promise<StorageInventoryRow[]> {
  const cachesApi = globalThis.caches;
  if (!cachesApi) return [unsupportedRow('Cache Storage')];
  const startedAt = Date.now();
  let rowCount = 0;
  let estimatedBytes = 0;
  for (const name of await cachesApi.keys()) {
    const cache = await cachesApi.open(name);
    for (const request of await cache.keys()) {
      if (Date.now() - startedAt > cacheInventoryDeadlineMs) {
        return [cacheRow(rowCount, estimatedBytes, 'timeout')];
      }
      rowCount += 1;
      const response = await cache.match(request);
      estimatedBytes += response ? await responseBytes(response) : 0;
    }
  }
  return [cacheRow(rowCount, estimatedBytes, 'exact')];
}

async function responseBytes(response: Response): Promise<number> {
  const blob = await response.clone().blob();
  return blob.size;
}

function cacheRow(
  rowCount: number,
  estimatedBytes: number,
  status: StorageInventoryRow['status'],
): StorageInventoryRow {
  return {
    table: 'Cache Storage',
    group: 'non-indexed',
    rowCount,
    estimatedBytes,
    status,
    reason: status === 'timeout' ? 'cache scan deadline reached' : undefined,
  };
}

function unsupportedRow(table: string): StorageInventoryRow {
  return {
    table,
    group: 'non-indexed',
    rowCount: null,
    estimatedBytes: 0,
    status: 'unsupported',
  };
}
