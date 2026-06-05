import { ensureEventGraphSchema } from '$lib/storage/sqlite-opfs/event-schema';
import { sendSqliteStorage } from '$lib/storage/sqlite-opfs/kernel-client';
import { readSqliteStorageHealth } from '$lib/storage/sqlite-opfs/storage-health';
import type { SqlScalar } from '$lib/storage/sqlite-opfs/types';
import {
  loadScanModelWasmPlanner,
  type ScanModelWasmResult,
} from './scan-model-wasm';
import type {
  ScanDecisionTraceRecord,
  ScanDensityModelRecord,
} from './scan-model-records';

export type ScanOptimizerDebugSnapshot = {
  readonly models: readonly ScanDensityModelRecord[];
  readonly decisionTraces: readonly ScanDecisionTraceRecord[];
  readonly storageMode: 'persistent-opfs' | 'temporary-memory' | 'unavailable';
  readonly unavailableMessage?: string;
  readonly wasmBridge: {
    readonly state: 'available' | ScanWasmUnavailableState;
    readonly message?: string;
  };
};

type ScanWasmUnavailableState = Exclude<
  ScanModelWasmResult<unknown>,
  { readonly ok: true }
>['reason'];

export type ScanOptimizerState =
  | ScanOptimizerDebugSnapshot['storageMode']
  | ScanOptimizerDebugSnapshot['wasmBridge']['state'];

const debugRowLimit = 24;

export async function readScanOptimizerDebugSnapshot(): Promise<ScanOptimizerDebugSnapshot> {
  const [models, decisionTraces, storage, wasmBridge] = await Promise.all([
    listRecentScanDensityModels(debugRowLimit),
    listRecentScanDecisionTraces(debugRowLimit),
    readScanStorageMode(),
    readScanWasmBridgeState(),
  ]);
  return {
    models,
    decisionTraces,
    storageMode: storage.mode,
    unavailableMessage: storage.message,
    wasmBridge,
  };
}

export const scanOptimizerSnapshot = readScanOptimizerDebugSnapshot;

export async function latestScanDecision(): Promise<
  ScanDecisionTraceRecord | undefined
> {
  return (await listRecentScanDecisionTraces(1))[0];
}

export async function listRecentScanDensityModels(
  limit = debugRowLimit,
): Promise<ScanDensityModelRecord[]> {
  const rows = await queryRows(
    'SELECT model_key, record_json FROM feed_scan_density_models ORDER BY updated_at_ms DESC LIMIT ?1;',
    [boundedLimit(limit)],
  );
  return rows.flatMap(modelRecord);
}

export async function listRecentScanDecisionTraces(
  limit = debugRowLimit,
): Promise<ScanDecisionTraceRecord[]> {
  const rows = await queryRows(
    'SELECT trace_id, model_key, semantic_feed_key, direction, record_json, created_at_ms FROM feed_scan_decision_traces ORDER BY created_at_ms DESC LIMIT ?1;',
    [boundedLimit(limit)],
  );
  return rows.map(traceRecord);
}

async function queryRows(
  statement: string,
  params: readonly SqlScalar[],
): Promise<readonly Record<string, unknown>[]> {
  if (typeof Worker === 'undefined') return [];
  if (!(await ensureEventGraphSchema())) return [];
  const response = await sendSqliteStorage(
    {
      kind: 'query',
      statement,
      params,
      rowLimit: boundedLimit(Number(params[0])),
    },
    { deadlineMs: 5_000 },
  );
  return response.outcome === 'ok' ? response.rows : [];
}

function modelRecord(row: Record<string, unknown>): ScanDensityModelRecord[] {
  const parsed = parseObject(row.record_json);
  if (!parsed) return [];
  const modelKey = text(parsed.modelKey) || text(row.model_key);
  if (!modelKey) return [];
  return [{ ...(parsed as unknown as ScanDensityModelRecord), modelKey }];
}

function traceRecord(row: Record<string, unknown>): ScanDecisionTraceRecord {
  const parsed = parseObject(row.record_json) ?? {};
  return {
    traceId: text(parsed.traceId) || text(row.trace_id) || fallbackTraceId(row),
    modelKey: text(parsed.modelKey) || text(row.model_key) || 'unknown-model',
    semanticFeedKey:
      text(parsed.semanticFeedKey) ||
      text(row.semantic_feed_key) ||
      'unknown-feed',
    direction:
      direction(parsed.direction) ?? direction(row.direction) ?? 'older',
    createdAtMs:
      numberValue(parsed.createdAtMs) ?? numberValue(row.created_at_ms) ?? 0,
    recordJson: parsed.recordJson ?? parsed,
  };
}

async function readScanStorageMode(): Promise<{
  readonly mode: ScanOptimizerDebugSnapshot['storageMode'];
  readonly message?: string;
}> {
  if (typeof Worker === 'undefined')
    return { mode: 'unavailable', message: 'Worker support unavailable' };
  try {
    const health = await readSqliteStorageHealth();
    if (health.status === 'available') return { mode: health.health.mode };
    return { mode: 'unavailable', message: health.message };
  } catch (error) {
    return { mode: 'unavailable', message: errorText(error) };
  }
}

async function readScanWasmBridgeState(): Promise<
  ScanOptimizerDebugSnapshot['wasmBridge']
> {
  const planner = await loadScanModelWasmPlanner();
  if (planner.ok) return { state: 'available' };
  return { state: planner.reason, message: planner.message };
}

function parseObject(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return record(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function fallbackTraceId(row: Record<string, unknown>): string {
  return [
    'trace',
    text(row.model_key),
    text(row.semantic_feed_key),
    text(row.created_at_ms),
  ]
    .filter(Boolean)
    .join(':');
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function direction(value: unknown): 'older' | 'newer' | undefined {
  return value === 'older' || value === 'newer' ? value : undefined;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function boundedLimit(value: number): number {
  if (!Number.isFinite(value)) return debugRowLimit;
  return Math.min(100, Math.max(0, Math.floor(value)));
}
