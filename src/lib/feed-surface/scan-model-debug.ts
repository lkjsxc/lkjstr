import { ensureEventGraphSchema } from '$lib/storage/sqlite-opfs/event-schema';
import { sendSqliteStorage } from '$lib/storage/sqlite-opfs/kernel-client';
import { readSqliteStorageHealth } from '$lib/storage/sqlite-opfs/storage-health';
import type { SqlScalar } from '$lib/storage/sqlite-opfs/types';
import { loadScanModelWasmPlanner } from './scan-model-wasm';
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
    readonly state: 'available' | 'unavailable';
    readonly message?: string;
  };
};

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
  return queryRecords(
    'SELECT record_json FROM feed_scan_density_models ORDER BY updated_at_ms DESC LIMIT ?1;',
    [boundedLimit(limit)],
  );
}

export async function listRecentScanDecisionTraces(
  limit = debugRowLimit,
): Promise<ScanDecisionTraceRecord[]> {
  return queryRecords(
    'SELECT record_json FROM feed_scan_decision_traces ORDER BY created_at_ms DESC LIMIT ?1;',
    [boundedLimit(limit)],
  );
}

async function queryRecords<T>(
  statement: string,
  params: readonly SqlScalar[],
): Promise<T[]> {
  if (typeof Worker === 'undefined') return [];
  if (!(await ensureEventGraphSchema())) return [];
  const limit = boundedLimit(Number(params[0] ?? debugRowLimit));
  const response = await sendSqliteStorage(
    { kind: 'query', statement, params, rowLimit: limit },
    { deadlineMs: 5_000 },
  );
  if (response.outcome !== 'ok') return [];
  return response.rows.flatMap((row) => decode<T>(row.record_json));
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
  return { state: 'unavailable', message: planner.message };
}

function decode<T>(raw: unknown): T[] {
  if (typeof raw !== 'string') return [];
  try {
    return [JSON.parse(raw) as T];
  } catch {
    return [];
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function boundedLimit(value: number): number {
  if (!Number.isFinite(value)) return debugRowLimit;
  return Math.min(100, Math.max(0, Math.floor(value)));
}
