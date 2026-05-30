import { encodedJsonBytes } from '../cache/cache-byte-size';
import { browserDb } from './browser-db';
import { boundedStorageRead, indexedDbAvailable } from './safe-storage';

export type StorageGroup =
  | 'protected'
  | 'prunable-cache'
  | 'derived-page-cache'
  | 'diagnostics'
  | 'ledger'
  | 'overhead'
  | 'unknown';

export type StorageInventoryRow = {
  readonly table: string;
  readonly group: StorageGroup;
  readonly rowCount: number | null;
  readonly estimatedBytes: number;
};

const tableGroups: Record<string, StorageGroup> = {
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
  relayRouteBlocks: 'diagnostics',
  cacheMeta: 'diagnostics',
};

export async function storageInventory(
  browserUsageBytes: number | null,
): Promise<StorageInventoryRow[]> {
  if (!indexedDbAvailable()) return overheadRows(browserUsageBytes, 0);
  const rows = await Promise.all(
    browserDb().tables.map((table) => storageTableRow(table)),
  );
  const knownBytes = rows.reduce((sum, row) => sum + row.estimatedBytes, 0);
  return [...rows, ...overheadRows(browserUsageBytes, knownBytes)];
}

export function storageGroup(tableName: string): StorageGroup {
  return tableGroups[tableName] ?? 'unknown';
}

async function storageTableRow(table: {
  readonly name: string;
  count: () => Promise<number>;
  each: (callback: (row: unknown) => void) => Promise<void>;
}): Promise<StorageInventoryRow> {
  return boundedStorageRead<StorageInventoryRow>(
    async () => {
      let estimatedBytes = 0;
      await table.each((row) => {
        estimatedBytes += encodedJsonBytes(row);
      });
      return {
        table: table.name,
        group: storageGroup(table.name),
        rowCount: await table.count(),
        estimatedBytes,
      };
    },
    {
      table: table.name,
      group: storageGroup(table.name),
      rowCount: null,
      estimatedBytes: 0,
    },
    1000,
  );
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
    },
  ];
}
