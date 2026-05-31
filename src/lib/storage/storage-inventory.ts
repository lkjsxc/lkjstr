import { encodedJsonBytes } from '../cache/cache-byte-size';
import { browserDb } from './browser-db';
import { indexedDbAvailable } from './safe-storage';
import { nonIndexedStorageInventory } from './non-indexed-storage-inventory';

export type StorageGroup =
  | 'protected'
  | 'protected-safety'
  | 'prunable-cache'
  | 'derived-page-cache'
  | 'diagnostics'
  | 'ledger'
  | 'metadata'
  | 'non-indexed'
  | 'overhead'
  | 'unknown';

export type StorageInventoryStatus =
  | 'exact'
  | 'timeout'
  | 'unavailable'
  | 'unsupported';

export type StorageInventoryRow = {
  readonly table: string;
  readonly group: StorageGroup;
  readonly rowCount: number | null;
  readonly estimatedBytes: number;
  readonly status: StorageInventoryStatus;
  readonly reason?: string;
};

export const knownStorageTables = [
  'workspaces',
  'accounts',
  'localAccountSecrets',
  'notifications',
  'tweetDrafts',
  'events',
  'cacheLedger',
  'eventRelays',
  'eventTags',
  'feedCursors',
  'feedCoverage',
  'feedScanHints',
  'jobs',
  'cacheMeta',
  'tabStates',
  'settings',
  'relaySets',
  'relayDiagnosticSummaries',
  'relayInformation',
  'relayListSuggestions',
  'authorRelayRoutes',
  'relayRouteBlocks',
] as const;

const tableGroups: Record<(typeof knownStorageTables)[number], StorageGroup> = {
  accounts: 'protected',
  localAccountSecrets: 'protected',
  settings: 'protected',
  relaySets: 'protected',
  tweetDrafts: 'protected',
  workspaces: 'protected',
  tabStates: 'protected',
  notifications: 'prunable-cache',
  events: 'prunable-cache',
  eventRelays: 'prunable-cache',
  eventTags: 'prunable-cache',
  cacheLedger: 'ledger',
  feedCursors: 'derived-page-cache',
  feedCoverage: 'derived-page-cache',
  feedScanHints: 'derived-page-cache',
  jobs: 'prunable-cache',
  relayInformation: 'diagnostics',
  relayDiagnosticSummaries: 'diagnostics',
  relayListSuggestions: 'diagnostics',
  authorRelayRoutes: 'diagnostics',
  relayRouteBlocks: 'protected-safety',
  cacheMeta: 'metadata',
};

export async function storageInventory(
  browserUsageBytes: number | null,
): Promise<StorageInventoryRow[]> {
  const indexedRows = indexedDbAvailable()
    ? await Promise.all(
        browserDb().tables.map((table) => storageTableRow(table)),
      )
    : [indexedDbUnavailableRow()];
  const nonIndexedRows = await nonIndexedStorageInventory();
  const rows = [...indexedRows, ...nonIndexedRows];
  const knownBytes = rows.reduce((sum, row) => sum + row.estimatedBytes, 0);
  return [...rows, ...overheadRows(browserUsageBytes, knownBytes)];
}

export function storageGroup(tableName: string): StorageGroup {
  return isKnownStorageTable(tableName) ? tableGroups[tableName] : 'unknown';
}

function isKnownStorageTable(
  tableName: string,
): tableName is (typeof knownStorageTables)[number] {
  return (knownStorageTables as readonly string[]).includes(tableName);
}

async function storageTableRow(table: {
  readonly name: string;
  each: (callback: (row: unknown) => false | void) => Promise<void>;
}): Promise<StorageInventoryRow> {
  const startedAt = Date.now();
  let estimatedBytes = 0;
  let rowCount = 0;
  let timedOut = false;
  try {
    await table.each((row) => {
      if (Date.now() - startedAt > 1000) {
        timedOut = true;
        return false;
      }
      rowCount += 1;
      estimatedBytes += encodedJsonBytes(row);
    });
    return {
      table: table.name,
      group: storageGroup(table.name),
      rowCount: timedOut ? null : rowCount,
      estimatedBytes,
      status: timedOut ? 'timeout' : 'exact',
      reason: timedOut ? 'table scan deadline reached' : undefined,
    };
  } catch (error) {
    return {
      table: table.name,
      group: storageGroup(table.name),
      rowCount: null,
      estimatedBytes,
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'table scan failed',
    };
  }
}

function overheadRows(
  browserUsageBytes: number | null,
  knownBytes: number,
): StorageInventoryRow[] {
  if (browserUsageBytes === null) return [];
  const estimatedBytes = Math.max(0, browserUsageBytes - knownBytes);
  if (estimatedBytes === 0) return [];
  return [
    {
      table: 'browser-overhead-or-unknown',
      group: 'overhead',
      rowCount: null,
      estimatedBytes,
      status: 'exact',
    },
  ];
}

function indexedDbUnavailableRow(): StorageInventoryRow {
  return {
    table: 'IndexedDB',
    group: 'unknown',
    rowCount: null,
    estimatedBytes: 0,
    status: 'unavailable',
  };
}
