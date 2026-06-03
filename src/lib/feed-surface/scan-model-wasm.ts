export type ScanModelWasmResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: 'unavailable' | 'error';
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
      reason: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
