import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  preflightWasmPack,
  WASM_PACK_VERSION,
  wasmPackCommandFromEnv,
} from './wasm-toolchain';

type SpawnResult = {
  readonly status: number | null;
  readonly stdout?: string | Buffer;
  readonly stderr?: string | Buffer;
  readonly error?: unknown;
};

type Runner = (
  command: string,
  args: readonly string[],
  options: { cwd: string; encoding: 'utf8'; env: NodeJS.ProcessEnv },
) => SpawnResult;

export function ensureWasmToolchainForBuild(repoRoot: string): boolean {
  addCargoBinToPath(process.env);
  const command = wasmPackCommandFromEnv();
  if (preflightWasmPack(command).ok) return false;
  if (command !== 'wasm-pack' || !shouldBootstrapWasmToolchain(process.env)) {
    return false;
  }
  console.log('Bootstrapping Rust/WASM toolchain for Cloudflare build.');
  if (!commandAvailable(repoRoot, 'cargo', ['--version']))
    installRust(repoRoot);
  runInstallStep(
    repoRoot,
    'rustup',
    ['target', 'add', 'wasm32-unknown-unknown'],
    'install wasm32 target',
  );
  runInstallStep(
    repoRoot,
    'cargo',
    [
      'install',
      'wasm-pack',
      '--locked',
      '--version',
      WASM_PACK_VERSION,
      '--force',
    ],
    'install wasm-pack',
  );
  return true;
}

export function shouldBootstrapWasmToolchain(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd(),
): boolean {
  if (env.LKJSTR_BOOTSTRAP_WASM_TOOLCHAIN === '1') return true;
  if (env.LKJSTR_BOOTSTRAP_WASM_TOOLCHAIN === '0') return false;
  return (
    env.CF_PAGES === '1' ||
    env.CF_BUILD_ID !== undefined ||
    env.CLOUDFLARE_BUILD === '1' ||
    env.HOME === '/opt/buildhome' ||
    cwd.startsWith('/opt/buildhome/')
  );
}

export function addCargoBinToPath(env: NodeJS.ProcessEnv): void {
  const home = env.HOME;
  if (!home) return;
  const cargoBin = path.join(home, '.cargo', 'bin');
  const parts = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  if (!parts.includes(cargoBin))
    env.PATH = [cargoBin, ...parts].join(path.delimiter);
}

function commandAvailable(
  repoRoot: string,
  command: string,
  args: readonly string[],
): boolean {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  return !result.error && result.status === 0;
}

function installRust(repoRoot: string): void {
  runInstallStep(
    repoRoot,
    'sh',
    [
      '-c',
      'curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain stable',
    ],
    'install Rust toolchain',
  );
  addCargoBinToPath(process.env);
}

function runInstallStep(
  repoRoot: string,
  command: string,
  args: readonly string[],
  label: string,
  run: Runner = spawnSync,
): SpawnResult {
  const result = run(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error || result.status !== 0) throw installError(label, result);
  return result;
}

function installError(label: string, result: SpawnResult): Error {
  const detail = result.error
    ? String(result.error)
    : tail(text(result.stderr) || text(result.stdout));
  return new Error(
    `Rust/WASM toolchain bootstrap failed during ${label}: ${detail}`,
  );
}

function text(value: string | Buffer | undefined): string {
  return typeof value === 'string' ? value : (value?.toString('utf8') ?? '');
}

function tail(value: string): string {
  return value.slice(-2000) || 'no output';
}

const scriptPath = process.argv[1];
if (scriptPath && import.meta.url === pathToFileURL(scriptPath).href) {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  ensureWasmToolchainForBuild(repoRoot);
  console.log('ok wasm-toolchain');
}
