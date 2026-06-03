import { ensureEventGraphSchema } from '$lib/storage/sqlite-opfs/event-schema';
import { sendSqliteStorage } from '$lib/storage/sqlite-opfs/kernel-client';
import type { SqlScalar, SqlStep } from '$lib/storage/sqlite-opfs/types';

export type ScanModelScope =
  | 'Exact'
  | 'RouteGroup'
  | 'RelayFilter'
  | 'SurfaceFilter'
  | 'Surface'
  | 'Global'
  | 'Neutral';

export type ScanModelContext = {
  readonly semanticFeedKey: string;
  readonly routeGroupKey: string;
  readonly relayUrl: string;
  readonly semanticFilterKey: string;
  readonly direction: 'older' | 'newer';
  readonly routeFingerprint: string;
};

export type ScanDensityModelRecord = ScanModelContext & {
  readonly modelKey: string;
  readonly scope: ScanModelScope;
  readonly targetLimitFraction: string;
  readonly densityEventsPerSecond: number;
  readonly sampleWeight: number;
  readonly updatedAtMs: number;
  readonly decaysAfterMs: number;
  readonly recordJson?: unknown;
};

export type ScanObservationRecord = ScanModelContext & {
  readonly id: string;
  readonly createdAtMs: number;
  readonly recordJson: unknown;
};

export type ScanDecisionTraceRecord = {
  readonly traceId: string;
  readonly modelKey: string;
  readonly semanticFeedKey: string;
  readonly direction: 'older' | 'newer';
  readonly createdAtMs: number;
  readonly recordJson: unknown;
};

export async function selectScanModelsForContext(
  context: ScanModelContext,
): Promise<ScanDensityModelRecord[] | undefined> {
  if (!(await ensureEventGraphSchema())) return undefined;
  const rows = await queryRecords<ScanDensityModelRecord>(
    'SELECT record_json FROM feed_scan_density_models WHERE direction = ?1 AND (semantic_feed_key = ?2 OR semantic_feed_key = \'\') ORDER BY updated_at_ms DESC LIMIT 64;',
    [context.direction, context.semanticFeedKey],
  );
  return rows.filter((row) => modelMatches(row, context)).toSorted(scopeSort);
}

export async function upsertScanDensityModels(
  rows: readonly ScanDensityModelRecord[],
): Promise<boolean> {
  return batch(rows.map(modelStep));
}

export async function insertScanObservation(
  row: ScanObservationRecord,
): Promise<boolean> {
  return batch([observationStep(row)]);
}

export async function insertScanDecisionTrace(
  row: ScanDecisionTraceRecord,
): Promise<boolean> {
  return batch([traceStep(row)]);
}

function modelStep(row: ScanDensityModelRecord): SqlStep {
  return {
    statement:
      'INSERT INTO feed_scan_density_models (model_key, scope, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, route_fingerprint, record_json, updated_at_ms, decays_after_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(model_key) DO UPDATE SET record_json = excluded.record_json, updated_at_ms = excluded.updated_at_ms, decays_after_ms = excluded.decays_after_ms;',
    params: [
      row.modelKey,
      row.scope,
      row.semanticFeedKey,
      row.routeGroupKey,
      row.relayUrl,
      row.semanticFilterKey,
      row.direction,
      row.routeFingerprint,
      JSON.stringify(row.recordJson ?? row),
      row.updatedAtMs,
      row.decaysAfterMs,
    ],
  };
}

function observationStep(row: ScanObservationRecord): SqlStep {
  return {
    statement:
      'INSERT INTO feed_scan_observations (id, semantic_feed_key, route_group_key, relay_url, semantic_filter_key, direction, route_fingerprint, record_json, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9);',
    params: [
      row.id,
      row.semanticFeedKey,
      row.routeGroupKey,
      row.relayUrl,
      row.semanticFilterKey,
      row.direction,
      row.routeFingerprint,
      JSON.stringify(row.recordJson),
      row.createdAtMs,
    ],
  };
}

function traceStep(row: ScanDecisionTraceRecord): SqlStep {
  return {
    statement:
      'INSERT INTO feed_scan_decision_traces (trace_id, model_key, semantic_feed_key, direction, record_json, created_at_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6);',
    params: [
      row.traceId,
      row.modelKey,
      row.semanticFeedKey,
      row.direction,
      JSON.stringify(row.recordJson),
      row.createdAtMs,
    ],
  };
}

async function batch(steps: readonly SqlStep[]): Promise<boolean> {
  if (steps.length === 0) return true;
  if (!(await ensureEventGraphSchema())) return false;
  const response = await sendSqliteStorage(
    { kind: 'batch', mode: 'readwrite', steps },
    { deadlineMs: 10_000 },
  );
  return response.outcome === 'ok';
}

async function queryRecords<T>(
  statement: string,
  params: readonly SqlScalar[],
): Promise<T[]> {
  const response = await sendSqliteStorage(
    { kind: 'query', statement, params, rowLimit: 64 },
    { deadlineMs: 10_000 },
  );
  if (response.outcome !== 'ok') return [];
  return response.rows.flatMap((row) => decode<T>(row.record_json));
}

function decode<T>(raw: unknown): T[] {
  if (typeof raw !== 'string') return [];
  try {
    return [JSON.parse(raw) as T];
  } catch {
    return [];
  }
}

function modelMatches(
  row: ScanDensityModelRecord,
  context: ScanModelContext,
): boolean {
  return (
    row.direction === context.direction &&
    matches(scopeUsesSurface(row.scope), row.semanticFeedKey, context.semanticFeedKey) &&
    matches(scopeUsesRoute(row.scope), row.routeGroupKey, context.routeGroupKey) &&
    matches(scopeUsesRelay(row.scope), row.relayUrl, context.relayUrl) &&
    matches(scopeUsesFilter(row.scope), row.semanticFilterKey, context.semanticFilterKey)
  );
}

function matches(used: boolean, left: string, right: string): boolean {
  return !used || left === right;
}

function scopeSort(a: ScanDensityModelRecord, b: ScanDensityModelRecord) {
  return scopeRank(a.scope) - scopeRank(b.scope) || a.modelKey.localeCompare(b.modelKey);
}

function scopeRank(scope: ScanModelScope): number {
  return ['Exact', 'RouteGroup', 'RelayFilter', 'SurfaceFilter', 'Surface', 'Global', 'Neutral'].indexOf(scope);
}

const scopeUsesSurface = (scope: ScanModelScope) =>
  ['Exact', 'RouteGroup', 'SurfaceFilter', 'Surface'].includes(scope);
const scopeUsesRoute = (scope: ScanModelScope) => ['Exact', 'RouteGroup'].includes(scope);
const scopeUsesRelay = (scope: ScanModelScope) => ['Exact', 'RelayFilter'].includes(scope);
const scopeUsesFilter = (scope: ScanModelScope) => ['Exact', 'RelayFilter', 'SurfaceFilter'].includes(scope);
