import type { CacheMetadata } from '$lib/cache/cache-status';

export type CacheStatusRow = {
  readonly label: string;
  readonly value: string;
};

export function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'unknown';
  const mib = 1024 * 1024;
  const gib = 1024 * mib;
  if (value >= gib) return `${(value / gib).toFixed(2)} GiB`;
  if (value >= mib) return `${Math.round(value / mib)} MiB`;
  return `${value} bytes`;
}

export function cacheSummaryRows(cache: CacheMetadata): CacheStatusRow[] {
  return [
    bytes('Site target', cache.budgetBytes),
    bytes('Browser origin usage', cache.browserUsageBytes),
    bytes('Over target', cache.overTargetBytes),
    bytes('Physical IndexedDB bytes', cache.indexedDbEstimatedBytes),
    bytes('Known app-managed cache', cache.knownAppManagedCacheBytes),
    bytes('Ledger-accounted resources', cache.ledgerBytes),
    bytes('Prunable cache', cache.prunableCacheBytes),
    bytes('Protected user data', cache.protectedUserBytes),
    bytes('Derived feed cache', cache.derivedFeedCacheBytes),
    bytes('Diagnostics cache', cache.diagnosticsCacheBytes),
    bytes('Physical cacheLedger store', cache.ledgerStoreBytes),
    bytes('Storage metadata', cache.metadataBytes),
    bytes('localStorage', cache.localStorageBytes),
    bytes('Cache Storage', cache.cacheStorageBytes),
    bytes('Unknown legacy or unowned', cache.unknownLegacyOrUnownedBytes),
    bytes('Residual browser overhead', cache.residualBrowserOverheadBytes),
    bytes('Event cache ledger bytes', cache.eventCacheBytes),
    text('Inventory status', cache.inventoryStatus),
    text('Pressure state', cache.pressureState),
    text('Last enforcement', cache.lastCompactionReason ?? 'none'),
    text('Last repair', repairSummary(cache)),
  ];
}

export function cacheCountRows(cache: CacheMetadata): CacheStatusRow[] {
  return [
    text('Ledger rows', cache.totalLedgerRows),
    text('Prunable ledger rows', cache.prunableLedgerRows),
    text('Protected ledger rows', cache.protectedLedgerRows),
    bytes('Protected ledger bytes', cache.protectedLedgerBytes),
    text('Orphan ledger rows', cache.orphanLedgerRows),
    text('Missing ledger rows', cache.missingLedgerRows),
    text('Pruned resources', cache.prunedResourceCount),
    text('Pruned events', cache.prunedEventCount),
    bytes('Pruned bytes', cache.prunedByteEstimate),
    text('Protected only', cache.protectedOnly ? 'yes' : 'no'),
    text('Unrecoverable pressure', cache.protectedOrUnknownOnly ? 'yes' : 'no'),
    text(
      'Skipped protected rows',
      `${cache.skippedDurablyProtected} durable / ${cache.skippedDynamicallyProtected} dynamic`,
    ),
    text('Active storage ops', cache.storageOperations.active),
    text('Timed-out storage ops', cache.storageOperations.returnedTimeout),
    text(
      'Late-settled storage ops',
      `${cache.storageOperations.lateSettled} ok / ${cache.storageOperations.lateRejected} failed`,
    ),
  ];
}

function repairSummary(cache: CacheMetadata): string {
  const repair = cache.lastRepairResult;
  if (!repair) return 'none';
  return `${repair.orphanLedgerRowsDeleted} orphan, ${repair.missingLedgerRowsInserted} missing, ${repair.unownedCacheRowsDeleted} unowned`;
}

function bytes(
  label: string,
  value: number | null | undefined,
): CacheStatusRow {
  return { label, value: formatBytes(value) };
}

function text(label: string, value: string | number): CacheStatusRow {
  return { label, value: String(value) };
}
