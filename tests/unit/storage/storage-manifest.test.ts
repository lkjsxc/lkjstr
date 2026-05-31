import { describe, expect, it } from 'vitest';
import { browserDb } from '../../../src/lib/storage/browser-db';
import {
  currentStorageSchemaStep,
  dexieStoreShape,
  removedStorageStores,
} from '../../../src/lib/storage/schema/dexie-schema';
import { storageTableSpecs } from '../../../src/lib/storage/schema/table-manifest';
import {
  isStorageTableName,
  storageTableNames,
} from '../../../src/lib/storage/schema/table-names';

describe('storage manifest', () => {
  it('owns every live Dexie table name', () => {
    expect(currentStorageSchemaStep).toBeGreaterThan(0);
    expect(storageTableNames).toHaveLength(storageTableSpecs.length);
    for (const table of browserDb().tables) {
      expect(isStorageTableName(table.name)).toBe(true);
    }
  });

  it('generates Dexie stores from live specs plus removed stores', () => {
    const shape = dexieStoreShape();
    for (const spec of storageTableSpecs) {
      expect(shape[spec.name]).toBe(spec.dexie);
    }
    for (const removed of Object.keys(removedStorageStores)) {
      expect(storageTableNames).not.toContain(removed);
      expect(shape[removed]).toBeNull();
    }
  });

  it('assigns retention fields coherently', () => {
    for (const spec of storageTableSpecs) {
      expect(spec.inventoryGroup).not.toBe('unknown');
      expect(spec.compactable).toBe(Boolean(spec.ledgerResourceKind));
      expect(spec.repairable).toBe(Boolean(spec.ledgerResourceKind));
    }
  });
});
