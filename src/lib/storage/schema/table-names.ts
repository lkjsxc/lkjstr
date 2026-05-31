import { storageTableSpecs } from './table-manifest';
import type { StorageTableName } from './table-spec';

export const storageTableNames = storageTableSpecs.map(
  (table) => table.name,
) as readonly StorageTableName[];

export function isStorageTableName(name: string): name is StorageTableName {
  return (storageTableNames as readonly string[]).includes(name);
}
