import { storageTableSpecs } from './table-manifest';
import type { StorageInventoryGroup, StorageTableName } from './table-spec';

export const storageTableGroups = Object.fromEntries(
  storageTableSpecs.map((table) => [table.name, table.inventoryGroup]),
) as Record<StorageTableName, StorageInventoryGroup>;

export function storageManifestGroup(
  tableName: StorageTableName,
): StorageInventoryGroup {
  return storageTableGroups[tableName];
}
