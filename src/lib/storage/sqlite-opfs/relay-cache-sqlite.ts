import type { CacheLedgerRecord } from '../../cache/cache-ledger-record';
import type { RelayDiagnosticSummary } from '../../relays/relay-diagnostic-summary';
import type { RelayInformationRecord } from '../../relays/relay-info-types';
import type { RelayListSuggestionRecord } from '../../relays/relay-list-suggestions';
import type {
  RelayRoute,
  RelayRouteBlock,
} from '../../relays/relay-route-types';
import { ensureRelayCacheSchema } from './relay-cache-schema';
import { sendSqliteStorage } from './kernel-client';
import {
  informationStep,
  routeBlockStep,
  routeStep,
  suggestionStep,
  summaryStep,
} from './relay-cache-steps';
import {
  cacheLedgerSqlStep,
  sqliteRecordBatch,
  sqliteRecordReadMany,
  sqliteRecordReadOne,
} from './sqlite-record-helpers';
import type { SqlStep } from './types';

export async function sqlitePutRelayDiagnosticSummaries(
  rows: readonly RelayDiagnosticSummary[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  return batch([
    ...rows.map(summaryStep),
    ...ledgerRows.map(cacheLedgerSqlStep),
  ]);
}

export function sqliteReadRelayDiagnosticSummary(relayUrl: string) {
  return sqliteRecordReadOne<RelayDiagnosticSummary>(
    ensureRelayCacheSchema,
    'relay_diagnostic_summaries',
    'relay_url = ?1',
    [relayUrl],
  );
}

export function sqliteReadRecentRelayDiagnosticSummaries(limit: number) {
  return sqliteRecordReadMany<RelayDiagnosticSummary>(
    ensureRelayCacheSchema,
    'relay_diagnostic_summaries',
    '1 = 1 ORDER BY updated_at_ms DESC',
    [],
    limit,
  );
}

export async function sqlitePutRelayInformation(
  record: RelayInformationRecord,
  ledgerRow: CacheLedgerRecord,
): Promise<boolean> {
  return batch([informationStep(record), cacheLedgerSqlStep(ledgerRow)]);
}

export function sqliteReadRelayInformation(relayUrl: string) {
  return sqliteRecordReadOne<RelayInformationRecord>(
    ensureRelayCacheSchema,
    'relay_information',
    'relay_url = ?1',
    [relayUrl],
  );
}

export function sqliteReadRecentRelayInformation() {
  return sqliteRecordReadMany<RelayInformationRecord>(
    ensureRelayCacheSchema,
    'relay_information',
    '1 = 1 ORDER BY fetched_at_ms DESC',
    [],
    500,
  );
}

export async function sqlitePutRelayListSuggestions(
  rows: readonly RelayListSuggestionRecord[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  return batch([
    ...rows.map(suggestionStep),
    ...ledgerRows.map(cacheLedgerSqlStep),
  ]);
}

export function sqliteReadRelayListSuggestions(accountPubkey: string) {
  return sqliteRecordReadMany<RelayListSuggestionRecord>(
    ensureRelayCacheSchema,
    'relay_list_suggestions',
    'account_pubkey = ?1 ORDER BY relay_url ASC',
    [accountPubkey],
    1000,
  );
}

export async function sqlitePutAuthorRelayRoutes(
  routes: readonly RelayRoute[],
  ledgerRows: readonly CacheLedgerRecord[],
): Promise<boolean> {
  return batch([
    ...routes.map(routeStep),
    ...ledgerRows.map(cacheLedgerSqlStep),
  ]);
}

export function sqliteReadAuthorRelayRoutes(authors: readonly string[]) {
  const unique = [...new Set(authors)];
  if (unique.length === 0) return Promise.resolve([]);
  const placeholders = unique.map((_, index) => `?${index + 1}`).join(', ');
  return sqliteRecordReadMany<RelayRoute>(
    ensureRelayCacheSchema,
    'author_relay_routes',
    `author_pubkey IN (${placeholders}) ORDER BY updated_at_ms DESC`,
    unique,
    2000,
  );
}

export function sqlitePutRelayRouteBlock(block: RelayRouteBlock) {
  return batch([routeBlockStep(block)]);
}

export async function sqliteDeleteRelayRouteBlock(
  id: string,
): Promise<boolean> {
  if (!(await ensureRelayCacheSchema())) return false;
  const response = await sendSqliteStorage(
    {
      kind: 'execute',
      statement: 'DELETE FROM relay_route_blocks WHERE relay_url = ?1;',
      params: [id],
    },
    { deadlineMs: 3_000 },
  );
  return response.outcome === 'ok';
}

export function sqliteReadRecentRelayRouteBlocks() {
  return sqliteRecordReadMany<RelayRouteBlock>(
    ensureRelayCacheSchema,
    'relay_route_blocks',
    '1 = 1 ORDER BY updated_at_ms DESC',
    [],
    500,
  );
}

function batch(steps: readonly SqlStep[]): Promise<boolean> {
  return sqliteRecordBatch(ensureRelayCacheSchema, steps);
}
