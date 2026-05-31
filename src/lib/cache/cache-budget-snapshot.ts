import {
  storageInventory,
  type StorageInventoryRow,
} from '../storage/storage-inventory';
import { indexedDbAvailable } from '../storage/safe-storage';
import {
  estimatedEventCacheBytes,
  estimatedLedgerBytes,
  estimatedLedgerBytesByOwner,
  estimatedPrunableCacheBytes,
  type LedgerInventoryRow,
} from './cache-ledger-stats';
import { deriveSiteStorageBudget } from './site-storage-budget';
import type { InventoryScanStatus } from './cache-budget-decision';
import type { StorageQuotaSnapshot } from './storage-quota';

export type CacheBudgetSnapshot = {
  readonly quota: StorageQuotaSnapshot | null;
  readonly budgetBytes: number;
  readonly siteBudgetBytes: number;
  readonly browserUsageBytes: number | null;
  readonly overTargetBytes: number;
  readonly ledgerBytes: number;
  readonly prunableCacheBytes: number;
  readonly protectedLedgerBytes: number;
  readonly eventCacheBytes: number;
  readonly tableEstimatedBytes: number;
  readonly indexedDbEstimatedBytes: number;
  readonly knownAppManagedCacheBytes: number;
  readonly derivedFeedCacheBytes: number;
  readonly diagnosticsCacheBytes: number;
  readonly ledgerStoreBytes: number;
  readonly metadataBytes: number;
  readonly localStorageBytes: number;
  readonly cacheStorageBytes: number;
  readonly unknownLegacyOrUnownedBytes: number;
  readonly residualBrowserOverheadBytes: number;
  readonly protectedUserBytes: number;
  readonly unknownOrOverheadBytes: number;
  readonly inventoryStatus: InventoryScanStatus;
  readonly totalLedgerRows: number;
  readonly prunableLedgerRows: number;
  readonly protectedLedgerRows: number;
  readonly ledgerInventory: readonly LedgerInventoryRow[];
  readonly storageInventory: readonly StorageInventoryRow[];
  readonly storageApiAvailable: boolean;
};

export async function cacheBudgetSnapshot(
  budgetBytes: number,
  quota: StorageQuotaSnapshot | null,
): Promise<CacheBudgetSnapshot> {
  const budget = deriveSiteStorageBudget(budgetBytes, quota);
  const ledgerInventory = await estimatedLedgerBytesByOwner();
  const inventory = await storageInventory(budget.browserUsageBytes);
  const tableEstimatedBytes = inventoryBytes(inventory, [
    'protected',
    'protected-safety',
    'prunable-cache',
    'derived-page-cache',
    'diagnostics',
    'ledger',
    'metadata',
  ]);
  const unknownLegacyOrUnownedBytes = inventoryBytes(inventory, ['unknown']);
  const residualBrowserOverheadBytes = inventoryBytes(inventory, ['overhead']);
  return {
    quota,
    budgetBytes,
    siteBudgetBytes: budget.siteBudgetBytes,
    browserUsageBytes: budget.browserUsageBytes,
    overTargetBytes: Math.max(
      0,
      (budget.browserUsageBytes ?? 0) - budget.siteBudgetBytes,
    ),
    ledgerBytes: await estimatedLedgerBytes(),
    prunableCacheBytes: await estimatedPrunableCacheBytes(),
    protectedLedgerBytes: sumLedger(ledgerInventory, 'protectedBytes'),
    eventCacheBytes: await estimatedEventCacheBytes(),
    tableEstimatedBytes,
    indexedDbEstimatedBytes: inventoryBytes(inventory, [
      'protected',
      'protected-safety',
      'prunable-cache',
      'derived-page-cache',
      'diagnostics',
      'ledger',
      'metadata',
      'unknown',
    ]),
    knownAppManagedCacheBytes: inventoryBytes(inventory, [
      'prunable-cache',
      'derived-page-cache',
      'diagnostics',
    ]),
    derivedFeedCacheBytes: inventoryBytes(inventory, ['derived-page-cache']),
    diagnosticsCacheBytes: inventoryBytes(inventory, ['diagnostics']),
    ledgerStoreBytes: inventoryBytes(inventory, ['ledger']),
    metadataBytes: inventoryBytes(inventory, ['metadata']),
    localStorageBytes: inventoryBytesByTable(inventory, 'localStorage'),
    cacheStorageBytes: inventoryBytesByTable(inventory, 'Cache Storage'),
    protectedUserBytes: inventoryBytes(inventory, [
      'protected',
      'protected-safety',
    ]),
    unknownLegacyOrUnownedBytes,
    residualBrowserOverheadBytes,
    unknownOrOverheadBytes:
      unknownLegacyOrUnownedBytes + residualBrowserOverheadBytes,
    inventoryStatus: aggregateInventoryStatus(inventory),
    totalLedgerRows: sumLedger(ledgerInventory, 'rowCount'),
    prunableLedgerRows: ledgerInventory.reduce(
      (sum, row) => sum + row.prunableRows,
      0,
    ),
    protectedLedgerRows: ledgerInventory.reduce(
      (sum, row) => sum + row.protectedRows,
      0,
    ),
    ledgerInventory,
    storageInventory: inventory,
    storageApiAvailable: indexedDbAvailable(),
  };
}

function aggregateInventoryStatus(
  inventory: readonly StorageInventoryRow[],
): InventoryScanStatus {
  if (inventory.some((row) => row.status === 'partial')) return 'partial';
  if (inventory.some((row) => row.status === 'timeout')) return 'timeout';
  if (inventory.some((row) => row.status === 'unavailable'))
    return 'unavailable';
  if (inventory.some((row) => row.status === 'unsupported'))
    return 'unsupported';
  return 'exact';
}

function inventoryBytes(
  rows: readonly StorageInventoryRow[],
  groups: readonly StorageInventoryRow['group'][],
): number {
  return rows
    .filter((row) => groups.includes(row.group))
    .reduce((sum, row) => sum + row.estimatedBytes, 0);
}

function inventoryBytesByTable(
  rows: readonly StorageInventoryRow[],
  table: string,
): number {
  return rows
    .filter((row) => row.table === table)
    .reduce((sum, row) => sum + row.estimatedBytes, 0);
}

function sumLedger(
  rows: readonly LedgerInventoryRow[],
  key: 'rowCount' | 'protectedBytes',
): number {
  return rows.reduce((sum, row) => sum + row[key], 0);
}
