import { storageManifestGroup } from '../schema/table-groups';
import { storageTableSpecs } from '../schema/table-manifest';
import { isStorageTableName } from '../schema/table-names';
import type {
  StorageInventoryDataClass,
  StorageInventoryOwnership,
  StorageInventoryRow,
  StorageInventoryStatus,
} from '../storage-inventory-types';
import { sendSqliteStorage } from './kernel-client';
import type { SqlRow, StorageMode, StorageOutcome } from './types';

const sqliteTableNames: Record<string, string> = {
  accounts: 'accounts',
  app_log: 'appLog',
  author_relay_routes: 'authorRelayRoutes',
  cache_ledger: 'cacheLedger',
  cache_meta: 'cacheMeta',
  event_relays: 'eventRelays',
  event_tags: 'eventTags',
  events: 'events',
  feed_coverage: 'feedCoverage',
  feed_cursors: 'feedCursors',
  feed_scan_decision_traces: 'feedScanDecisionTraces',
  feed_scan_density_models: 'feedScanDensityModels',
  feed_scan_hints: 'feedScanHints',
  feed_scan_observations: 'feedScanObservations',
  jobs: 'jobs',
  local_account_secrets: 'localAccountSecrets',
  notifications: 'notifications',
  relay_diagnostic_summaries: 'relayDiagnosticSummaries',
  relay_information: 'relayInformation',
  relay_list_suggestions: 'relayListSuggestions',
  relay_route_blocks: 'relayRouteBlocks',
  relay_sets: 'relaySets',
  settings: 'settings',
  tab_states: 'tabStates',
  tweet_drafts: 'tweetDrafts',
  workspaces: 'workspaces',
};

const derivedTables = new Set([
  'feedScanDecisionTraces',
  'feedScanDensityModels',
  'feedScanObservations',
]);

export type SqlitePhysicalInventoryResult = {
  readonly mode: StorageMode | 'unavailable';
  readonly rows: readonly StorageInventoryRow[];
  readonly outcome: StorageOutcome;
  readonly reason?: string;
};

export async function readSqlitePhysicalInventory(
  deadlineMs = 2_000,
): Promise<SqlitePhysicalInventoryResult> {
  const response = await sendSqliteStorage(
    { kind: 'read-physical-inventory' },
    { deadlineMs },
  ).catch(() => undefined);
  if (!response || response.outcome !== 'ok') return unavailable(response);
  return {
    mode: response.diagnostics.mode ?? 'unavailable',
    outcome: response.outcome,
    rows: response.rows.map(rowFromSqlite),
  };
}

function rowFromSqlite(row: SqlRow): StorageInventoryRow {
  const table = stringValue(row.table, 'unknown-sqlite-table');
  const logical = sqliteTableNames[table] ?? table;
  const group = derivedTables.has(logical)
    ? 'derived-page-cache'
    : groupFor(logical);
  return {
    table,
    kind: 'sqlite-table',
    ownership: ownershipFor(logical),
    dataClass: dataClassFor(logical),
    group,
    rowCount: numberOrNull(row.row_count),
    estimatedBytes: numberOrZero(row.estimated_bytes),
    status: statusValue(row.status),
    reason: stringOptional(row.reason),
    recoverable: group !== 'protected' && group !== 'protected-safety',
  };
}

function unavailable(
  response:
    | {
        readonly outcome: StorageOutcome;
        readonly diagnostics?: { readonly message?: string };
      }
    | undefined,
): SqlitePhysicalInventoryResult {
  return {
    mode: 'unavailable',
    outcome: response?.outcome ?? 'unavailable',
    reason: response?.diagnostics?.message,
    rows: [
      {
        table: 'SQLite',
        kind: 'sqlite-table',
        ownership: 'unknown-unowned',
        dataClass: 'unknown-legacy-or-unowned-storage',
        group: 'unknown',
        rowCount: null,
        estimatedBytes: 0,
        status: response?.outcome === 'timeout' ? 'timeout' : 'unavailable',
        reason:
          response?.diagnostics?.message ?? 'SQLite inventory unavailable',
        recoverable: false,
      },
    ],
  };
}

function ownershipFor(logical: string): StorageInventoryOwnership {
  if (groupFor(logical) === 'unknown') return 'unknown-unowned';
  return 'current-known-store';
}

function dataClassFor(logical: string): StorageInventoryDataClass {
  if (derivedTables.has(logical)) return 'derived-feed-cache';
  return (
    storageTableSpecs.find((table) => table.name === logical)?.dataClass ??
    'unknown-legacy-or-unowned-storage'
  );
}

function groupFor(logical: string): StorageInventoryRow['group'] {
  return isStorageTableName(logical)
    ? storageManifestGroup(logical)
    : 'unknown';
}

function statusValue(value: SqlRow[string]): StorageInventoryStatus {
  return value === 'unavailable' ? 'unavailable' : 'estimated';
}

function numberOrNull(value: SqlRow[string]): number | null {
  return typeof value === 'number' ? value : null;
}

function numberOrZero(value: SqlRow[string]): number {
  return typeof value === 'number' ? value : 0;
}

function stringValue(value: SqlRow[string], fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function stringOptional(value: SqlRow[string]): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
