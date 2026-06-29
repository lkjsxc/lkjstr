import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  bridgeRelativeImports,
  defaultWasmArtifactDir,
  hasWasmMagic,
  readAssetManifest,
  sha256,
  WASM_ASSET_DIR_NAME,
  WASM_MANIFEST_NAME,
  type WasmAssetManifest,
  type WasmManifestAsset,
} from './wasm-assets';

export type VerifyWasmOptions = {
  readonly repoRoot?: string;
  readonly sourceDir?: string;
  readonly cloudflareDir?: string;
  readonly headersPath?: string;
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
  const cloudflareDir =
    options.cloudflareDir ??
    path.join(repoRoot, '.svelte-kit', 'cloudflare', WASM_ASSET_DIR_NAME);
  await verifyDirectory(cloudflareDir, 'Cloudflare emitted Rust/WASM assets');
  await verifyManifestHeaders(
    options.headersPath ?? path.join(path.dirname(cloudflareDir), '_headers'),
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
  await verifyBridgeImports(directory, manifest, script, label);
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

async function verifyBridgeImports(
  directory: string,
  manifest: WasmAssetManifest,
  script: string,
  label: string,
): Promise<void> {
  const imports = bridgeRelativeImports(script);
  const tracked = new Set(manifest.imports.map((item) => item.name));
  const missing = imports.filter((name) => !tracked.has(name));
  if (missing.length > 0) {
    throw new Error(
      `${label} has untracked bridge imports: ${missing.join(', ')}`,
    );
  }
  for (const item of manifest.imports) {
    await verifyAsset(directory, item, label, 'bridge import');
  }
}

export async function verifyManifestHeaders(
  headersPath: string,
): Promise<void> {
  const text = await readFile(headersPath, 'utf8').catch((error) => {
    throw new Error(`Cloudflare _headers missing. ${hint(error)}`);
  });
  const rule = findManifestHeaderRule(text);
  if (!rule) {
    throw new Error('Cloudflare _headers missing bridge manifest rule.');
  }
  if (!/^Cache-Control:\s*no-cache$/im.test(rule)) {
    throw new Error(
      'Cloudflare bridge manifest must use Cache-Control: no-cache.',
    );
  }
}

function findManifestHeaderRule(text: string): string | undefined {
  const manifestPath = `/${WASM_ASSET_DIR_NAME}/${WASM_MANIFEST_NAME}`;
  let active = false;
  let block: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      if (active) return block.join('\n');
      active = trimmed === manifestPath;
      block = [];
      continue;
    }
    if (active) block.push(trimmed);
  }
  return active ? block.join('\n') : undefined;
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
