export const rustWasmArtifactMissingMessage =
  'Rust/WASM bridge unavailable: local WASM artifact is missing. Run pnpm rust-wasm:quiet or use Docker verification.';

const rawToolchainFragments = [
  'spawnSync wasm-pack',
  'wasm-pack unavailable',
  'ENOENT',
  'LKJSTR_SKIP_WASM_PACK',
];

const bridgeArtifactFragments = [
  'local WASM artifact is missing',
  'lkjstr-web WASM was not built',
  'lkjstr-web WASM unavailable in tests',
];

export function rustWasmBridgeErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message = errorText(error);
  if (!message) return fallback;
  if (isToolchainLeak(message) || isArtifactUnavailable(message)) {
    return rustWasmArtifactMissingMessage;
  }
  return isBridgeUnavailable(message) ? message : fallback;
}

export function rustWasmDiagnosticMessage(error: unknown): string {
  return rustWasmBridgeErrorMessage(error, rustWasmArtifactMissingMessage);
}

export function isToolchainLeak(message: string): boolean {
  return rawToolchainFragments.some((fragment) => message.includes(fragment));
}

function isArtifactUnavailable(message: string): boolean {
  return bridgeArtifactFragments.some((fragment) => message.includes(fragment));
}

function isBridgeUnavailable(message: string): boolean {
  return /\b(Rust|WASM|bridge|diagnostics).*unavailable\b/i.test(message);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : '';
}
