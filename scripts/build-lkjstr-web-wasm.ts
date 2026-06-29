import { spawnSync } from 'node:child_process';
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  addCargoBinToPath,
  ensureWasmToolchainForBuild,
} from './install-wasm-toolchain';
import {
  bridgeRelativeImports,
  defaultWasmArtifactDir,
  fileEvidence,
  hasWasmMagic,
  WASM_BINARY_NAME,
  WASM_MANIFEST_NAME,
  WASM_SCRIPT_NAME,
  type WasmAssetManifest,
} from './wasm-assets';
import {
  missingWasmPackDiagnostic,
  preflightWasmPack,
  wasmPackCommandFromEnv,
} from './wasm-toolchain';

export type BuildWasmOptions = {
  readonly repoRoot?: string;
  readonly artifactDir?: string;
  readonly generatedAt?: string;
};

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

export async function buildLkjstrWebWasm(
  options: BuildWasmOptions = {},
): Promise<WasmAssetManifest> {
  const repoRoot = options.repoRoot ?? path.resolve(scriptDir, '..');
  const artifactDir = options.artifactDir ?? defaultWasmArtifactDir(repoRoot);
  addCargoBinToPath(process.env);
  const command = wasmPackCommandFromEnv();
  let preflight = preflightWasmPack(command);
  if (!preflight.ok) {
    ensureWasmToolchainForBuild(repoRoot);
    preflight = preflightWasmPack(command);
  }
  if (!preflight.ok) throw new Error(preflight.diagnostic);

  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });
  const result = spawnSync(command, wasmPackArgs(repoRoot, artifactDir), {
    cwd: repoRoot,
    encoding: 'utf8',
    env: buildEnv(),
  });
  if (result.error) throw new Error(missingWasmPackDiagnostic(command));
  if (result.status !== 0) {
    throw new Error(
      `wasm-pack build failed: ${tail(result.stderr || result.stdout)}`,
    );
  }

  const manifest = await createBuildManifest(
    repoRoot,
    artifactDir,
    options.generatedAt ?? new Date().toISOString(),
  );
  await writeFile(
    path.join(artifactDir, WASM_MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

export async function createBuildManifest(
  repoRoot: string,
  artifactDir: string,
  generatedAt: string,
): Promise<WasmAssetManifest> {
  const script = await readRequiredFile(artifactDir, WASM_SCRIPT_NAME);
  const wasm = await readRequiredFile(artifactDir, WASM_BINARY_NAME);
  if (!hasWasmMagic(wasm)) {
    throw new Error('wasm-pack emitted an invalid lkjstr_web_bg.wasm file');
  }
  return {
    generatedAt,
    target: 'web',
    script: await requiredEvidence(repoRoot, artifactDir, WASM_SCRIPT_NAME),
    wasm: await requiredEvidence(repoRoot, artifactDir, WASM_BINARY_NAME),
    imports: await importEvidence(
      repoRoot,
      artifactDir,
      script.toString('utf8'),
    ),
  };
}

async function requiredEvidence(
  repoRoot: string,
  artifactDir: string,
  name: string,
) {
  await readRequiredFile(artifactDir, name);
  return fileEvidence(
    artifactDir,
    name,
    relativeArtifactPath(repoRoot, artifactDir, name),
  );
}

async function importEvidence(
  repoRoot: string,
  artifactDir: string,
  script: string,
) {
  return Promise.all(
    bridgeRelativeImports(script).map((name) =>
      requiredEvidence(repoRoot, artifactDir, name),
    ),
  );
}

async function readRequiredFile(
  artifactDir: string,
  name: string,
): Promise<Buffer> {
  return readFile(path.join(artifactDir, name)).catch(() => {
    throw new Error(`wasm-pack did not emit required bridge artifact ${name}`);
  });
}

function wasmPackArgs(repoRoot: string, artifactDir: string): string[] {
  return [
    'build',
    '--target',
    'web',
    '--out-dir',
    path.relative(repoRoot, artifactDir) || '.',
    '--out-name',
    'lkjstr_web',
    '--no-typescript',
  ];
}

function buildEnv(): NodeJS.ProcessEnv {
  const cargoPath = `${process.env.HOME ?? ''}/.cargo/bin`;
  return { ...process.env, PATH: `${cargoPath}:${process.env.PATH ?? ''}` };
}

function relativeArtifactPath(
  repoRoot: string,
  artifactDir: string,
  name: string,
): string {
  return path.join(path.relative(repoRoot, artifactDir), name);
}

function tail(text: string): string {
  return text.slice(-4000) || 'no output';
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const manifest = await buildLkjstrWebWasm();
  console.log(
    `ok rust-wasm:build ${manifest.script.bytes} js bytes ${manifest.wasm.bytes} wasm bytes`,
  );
}
