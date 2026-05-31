import { storageTableSpecs } from './table-manifest';

export const currentStorageSchemaStep = 18;

export const removedStorageStores = {
  ['pass' + 'keyAccountSecrets']: null,
} as const;

export function dexieStoreShape(): Record<string, string | null> {
  return {
    ...Object.fromEntries(
      storageTableSpecs.map((table) => [table.name, table.dexie]),
    ),
    ...removedStorageStores,
  };
}
