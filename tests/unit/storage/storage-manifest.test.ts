import { describe, expect, it } from 'vitest';
import { storageTableSpecs } from '../../../src/lib/storage/schema/table-manifest';
import {
  isStorageTableName,
  storageTableNames,
} from '../../../src/lib/storage/schema/table-names';

describe('storage manifest', () => {
  it('owns every live logical table name', () => {
    expect(storageTableNames).toHaveLength(storageTableSpecs.length);
    for (const table of storageTableSpecs) {
      expect(isStorageTableName(table.name)).toBe(true);
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
