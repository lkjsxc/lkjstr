import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  defaultWasmArtifactDir,
  hasWasmMagic,
  readAssetManifest,
  sha256,
  WASM_ASSET_DIR_NAME,
  type WasmAssetManifest,
  type WasmManifestAsset,
} from './wasm-assets';

export type VerifyWasmOptions = {
  readonly repoRoot?: string;
  readonly sourceDir?: string;
  readonly cloudflareDir?: string;
};

const repoRootFromScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export async function verifyBuiltWasmAssets(
  options: VerifyWasmOptions = {},
): Promise<void> {
  const repoRoot = options.repoRoot ?? repoRootFromScript;
  await verifyDirectory(
    options.sourceDir ?? defaultWasmArtifactDir(repoRoot),
    'source Rust/WASM artifacts',
  );
  await verifyDirectory(
    options.cloudflareDir ??
      path.join(repoRoot, '.svelte-kit', 'cloudflare', WASM_ASSET_DIR_NAME),
    'Cloudflare emitted Rust/WASM assets',
  );
}

export async function verifyDirectory(
  directory: string,
  label: string,
): Promise<WasmAssetManifest> {
  const manifest = await readAssetManifest(directory).catch((error) => {
    throw new Error(`${label} missing asset-manifest.json. ${hint(error)}`);
  });
  await verifyAsset(directory, manifest.script, label, 'script');
  const wasm = await verifyAsset(directory, manifest.wasm, label, 'wasm');
  if (!hasWasmMagic(wasm)) {
    throw new Error(`${label} has invalid WASM bytes. Run pnpm build.`);
  }
  const script = await readFile(
    path.join(directory, manifest.script.name),
    'utf8',
  );
  if (!looksLikeWasmBindgen(script)) {
    throw new Error(`${label} JavaScript bridge is not a wasm-bindgen module.`);
  }
  return manifest;
}

async function verifyAsset(
  directory: string,
  asset: WasmManifestAsset,
  label: string,
  kind: string,
): Promise<Buffer> {
  const bytes = await readFile(path.join(directory, asset.name)).catch(
    (error) => {
      throw new Error(
        `${label} missing ${kind} asset ${asset.name}. ${hint(error)}`,
      );
    },
  );
  if (bytes.length === 0) throw new Error(`${label} ${kind} asset is empty.`);
  if (bytes.length !== asset.bytes) {
    throw new Error(
      `${label} ${kind} asset byte size does not match manifest.`,
    );
  }
  if (sha256(bytes) !== asset.sha256) {
    throw new Error(`${label} ${kind} asset digest does not match manifest.`);
  }
  return bytes;
}

function looksLikeWasmBindgen(source: string): boolean {
  return (
    source.length > 0 &&
    (/export\s+default/.test(source) || source.includes('__wbg_init')) &&
    (source.includes('wasm') || source.includes('init'))
  );
}

function hint(error: unknown): string {
  return `${error instanceof Error ? error.message : String(error)} Run pnpm build.`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await verifyBuiltWasmAssets();
  console.log('ok wasm-assets');
}
