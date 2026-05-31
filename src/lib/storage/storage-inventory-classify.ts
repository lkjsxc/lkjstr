import { removedStorageStores } from './schema/dexie-schema';
import { storageManifestGroup } from './schema/table-groups';
import { storageTableSpecs } from './schema/table-manifest';
import { isStorageTableName } from './schema/table-names';
import type {
  StorageInventoryDataClass,
  StorageInventoryOwnership,
  StorageGroup,
} from './storage-inventory-types';

export type StoreClassification = {
  readonly dataClass: StorageInventoryDataClass;
  readonly group: StorageGroup;
  readonly ownership: StorageInventoryOwnership;
  readonly recoverable: boolean;
  readonly reason?: string;
};

const protectedLegacyStores = new Set(Object.keys(removedStorageStores));

export function classifyIndexedDbStore(
  database: string,
  store: string,
): StoreClassification {
  if (database !== 'lkjstr') return unknown(`foreign database ${database}`);
  if (isStorageTableName(store)) {
    const spec = storageTableSpecs.find((row) => row.name === store);
    return {
      dataClass: spec?.dataClass ?? 'unknown-legacy-or-unowned-storage',
      group: storageManifestGroup(store),
      ownership: 'current-known-store',
      recoverable: Boolean(spec?.compactable),
    };
  }
  if (protectedLegacyStores.has(store))
    return {
      dataClass: 'unknown-legacy-or-unowned-storage',
      group: 'unknown',
      ownership: 'legacy-protected',
      recoverable: false,
      reason: 'obsolete protected store is not auto-deleted',
    };
  return unknown('object store is not in the current manifest');
}

export function storageDataClass(
  tableName: string,
): StorageInventoryDataClass | undefined {
  return storageTableSpecs.find((table) => table.name === tableName)?.dataClass;
}

function unknown(reason: string): StoreClassification {
  return {
    dataClass: 'unknown-legacy-or-unowned-storage',
    group: 'unknown',
    ownership: 'unknown-unowned',
    recoverable: false,
    reason,
  };
}
