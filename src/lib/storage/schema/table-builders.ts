import type { StorageTableSpec } from './table-spec';

export function table(
  name: StorageTableSpec['name'],
  dexie: string,
  dataClass: StorageTableSpec['dataClass'],
  inventoryGroup: StorageTableSpec['inventoryGroup'],
  primaryOwner: string,
  protectedByDefault: boolean,
): StorageTableSpec {
  return {
    name,
    dexie,
    dataClass,
    inventoryGroup,
    primaryOwner,
    protectedByDefault,
    repairable: false,
    compactable: false,
  };
}

export function ledgerTable(
  name: StorageTableSpec['name'],
  dexie: string,
  dataClass: StorageTableSpec['dataClass'],
  inventoryGroup: StorageTableSpec['inventoryGroup'],
  primaryOwner: string,
  ledgerResourceKind: NonNullable<StorageTableSpec['ledgerResourceKind']>,
  protectedByDefault = false,
): StorageTableSpec {
  return {
    name,
    dexie,
    dataClass,
    inventoryGroup,
    primaryOwner,
    ledgerResourceKind,
    protectedByDefault,
    repairable: true,
    compactable: true,
  };
}
