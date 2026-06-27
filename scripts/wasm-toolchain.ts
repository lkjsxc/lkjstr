import { spawnSync } from 'node:child_process';

export const WASM_PACK_VERSION = '0.15.0';
export const WASM_PACK_INSTALL_COMMAND = `cargo install wasm-pack --locked --version ${WASM_PACK_VERSION}`;
export const LOCAL_WASM_ARTIFACT_MISSING_MESSAGE =
  'Rust/WASM bridge unavailable: local WASM artifact is missing. Run pnpm rust-wasm:quiet or use Docker verification.';

export type ToolchainPreflight =
  | { readonly ok: true; readonly version: string }
  | {
      readonly ok: false;
      readonly diagnostic: string;
      readonly productMessage: string;
    };

type SpawnResult = {
  readonly status: number | null;
  readonly stdout?: string | Buffer;
  readonly stderr?: string | Buffer;
  readonly error?: unknown;
};

type SpawnRunner = (
  command: string,
  args: readonly string[],
  options: { readonly encoding: 'utf8' },
) => SpawnResult;

export function wasmPackCommandFromEnv(): string {
  return process.env.LKJSTR_WASM_PACK || 'wasm-pack';
}

export function preflightWasmPack(
  command = wasmPackCommandFromEnv(),
  run: SpawnRunner = spawnSync,
): ToolchainPreflight {
  const result = run(command, ['--version'], { encoding: 'utf8' });
  if (result.error) {
    return missingTool(command);
  }
  if (result.status !== 0) {
    return {
      ok: false,
      productMessage: LOCAL_WASM_ARTIFACT_MISSING_MESSAGE,
      diagnostic: [
        `Rust/WASM tool preflight failed: ${command} --version exited ${result.status ?? 'unknown'}.`,
        installHint(),
        tail(text(result.stderr) || text(result.stdout)),
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }
  const version = text(result.stdout).trim();
  if (!version.includes(WASM_PACK_VERSION)) {
    return {
      ok: false,
      productMessage: LOCAL_WASM_ARTIFACT_MISSING_MESSAGE,
      diagnostic: [
        `Rust/WASM tool preflight failed: ${command} reported ${version || 'unknown'}.`,
        `Required wasm-pack version is ${WASM_PACK_VERSION}.`,
        installHint(),
      ].join('\n'),
    };
  }
  return { ok: true, version };
}

export function missingWasmPackDiagnostic(command = 'wasm-pack'): string {
  return [
    `Missing required Rust/WASM build tool: ${command}.`,
    installHint(),
  ].join(' ');
}

function missingTool(command: string): ToolchainPreflight {
  return {
    ok: false,
    productMessage: LOCAL_WASM_ARTIFACT_MISSING_MESSAGE,
    diagnostic: missingWasmPackDiagnostic(command),
  };
}

function installHint(): string {
  return `Install it with ${WASM_PACK_INSTALL_COMMAND}, or run Docker verification with docker compose.`;
}

function text(value: string | Buffer | undefined): string {
  return typeof value === 'string' ? value : (value?.toString('utf8') ?? '');
}

function tail(value: string): string {
  return value.slice(-1200);
}
