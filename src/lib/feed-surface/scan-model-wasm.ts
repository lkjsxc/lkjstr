import { rustWasmDiagnosticMessage } from '$lib/rust-wasm/bridge-unavailable';
import type { ScanBridgeFailureReason } from './scan-model-bridge-validation';

export type ScanModelWasmResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: Extract<
        ScanBridgeFailureReason,
        'unavailable' | 'timeout' | 'invalid-input'
      >;
      readonly message: string;
    };

export type ScanModelWasmExports = {
  readonly plan_feed_scan_from_js?: (input: unknown) => unknown;
  readonly reduce_feed_scan_observation_from_js?: (input: unknown) => unknown;
  readonly select_scan_model_keys_from_js?: (input: unknown) => unknown;
};

export type ScanModelWasmPlanner = {
  readonly plan: <T>(input: unknown) => ScanModelWasmResult<T>;
  readonly reduce: <T>(input: unknown) => ScanModelWasmResult<T>;
  readonly selectKeys: <T>(input: unknown) => ScanModelWasmResult<T>;
};

const bridgeLoadDeadlineMs = 5_000;

export async function loadScanModelWasmPlanner(): Promise<
  ScanModelWasmResult<ScanModelWasmPlanner>
> {
  return withBridgeTimeout(loadScanModelWasmPlannerUnbounded());
}

async function loadScanModelWasmPlannerUnbounded(): Promise<
  ScanModelWasmResult<ScanModelWasmPlanner>
> {
  try {
    const module = await import('virtual:lkjstr-web-wasm');
    const exports = (await module.loadLkjstrWebWasm()) as ScanModelWasmExports;
    return { ok: true, value: createScanModelWasmPlanner(exports) };
  } catch (error) {
    return {
      ok: false,
      reason: 'unavailable',
      message: rustWasmDiagnosticMessage(error),
    };
  }
}

async function withBridgeTimeout<T>(
  input: Promise<ScanModelWasmResult<T>>,
): Promise<ScanModelWasmResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ScanModelWasmResult<T>>((resolve) => {
    timer = setTimeout(() => {
      resolve({
        ok: false,
        reason: 'timeout',
        message: 'scan model WASM bridge load timed out',
      });
    }, bridgeLoadDeadlineMs);
  });
  try {
    return await Promise.race([input, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createScanModelWasmPlanner(
  exports: ScanModelWasmExports | undefined,
): ScanModelWasmPlanner {
  return {
    plan: <T>(input: unknown) =>
      call<T>('plan', exports?.plan_feed_scan_from_js, input),
    reduce: <T>(input: unknown) =>
      call<T>('reduce', exports?.reduce_feed_scan_observation_from_js, input),
    selectKeys: <T>(input: unknown) =>
      call<T>('select-keys', exports?.select_scan_model_keys_from_js, input),
  };
}

function call<T>(
  label: string,
  fn: ((input: unknown) => unknown) | undefined,
  input: unknown,
): ScanModelWasmResult<T> {
  if (!fn)
    return {
      ok: false,
      reason: 'unavailable',
      message: `scan model WASM ${label} bridge unavailable`,
    };
  try {
    return { ok: true, value: fn(input) as T };
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid-input',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
