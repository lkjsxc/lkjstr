import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const WASM_ASSET_DIR_NAME = 'lkjstr-web-wasm';
export const WASM_MANIFEST_NAME = 'asset-manifest.json';
export const WASM_SCRIPT_NAME = 'lkjstr_web.js';
export const WASM_BINARY_NAME = 'lkjstr_web_bg.wasm';

export type WasmManifestAsset = {
  readonly name: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly path: string;
};

export type WasmAssetManifest = {
  readonly generatedAt: string;
  readonly target: string;
  readonly script: WasmManifestAsset;
  readonly wasm: WasmManifestAsset;
};

export function defaultWasmArtifactDir(repoRoot: string): string {
  return process.env.LKJSTR_WEB_WASM_DIR
    ? path.resolve(process.env.LKJSTR_WEB_WASM_DIR)
    : path.join(repoRoot, 'target', WASM_ASSET_DIR_NAME);
}

export async function fileEvidence(
  directory: string,
  name: string,
  pathLabel: string,
): Promise<WasmManifestAsset> {
  const bytes = await readFile(path.join(directory, name));
  return { name, path: pathLabel, bytes: bytes.length, sha256: sha256(bytes) };
}

export async function readAssetManifest(
  directory: string,
): Promise<WasmAssetManifest> {
  const text = await readFile(path.join(directory, WASM_MANIFEST_NAME), 'utf8');
  return parseAssetManifest(text, directory);
}

export function parseAssetManifest(
  text: string,
  source = WASM_MANIFEST_NAME,
): WasmAssetManifest {
  const value = JSON.parse(text) as Partial<WasmAssetManifest>;
  if (!isAsset(value.script) || !isAsset(value.wasm) || !value.generatedAt) {
    throw new Error(`invalid Rust/WASM asset manifest: ${source}`);
  }
  return { ...value, target: value.target ?? 'web' } as WasmAssetManifest;
}

export function contentAddressedName(name: string, sha: string): string {
  const extension = path.extname(name);
  const base = name.slice(0, name.length - extension.length);
  return `${base}-${sha.slice(0, 16)}${extension}`;
}

export function publicWasmAssetPath(name: string): string {
  return `/${WASM_ASSET_DIR_NAME}/${name}`;
}

export async function emittedAssetManifest(
  directory: string,
  manifest: WasmAssetManifest,
  scriptName: string,
  wasmName: string,
): Promise<WasmAssetManifest> {
  const script = await fileEvidence(
    directory,
    manifest.script.name,
    publicWasmAssetPath(scriptName),
  );
  const wasm = await fileEvidence(
    directory,
    manifest.wasm.name,
    publicWasmAssetPath(wasmName),
  );
  return {
    generatedAt: manifest.generatedAt,
    target: manifest.target,
    script: { ...script, name: scriptName },
    wasm: { ...wasm, name: wasmName },
  };
}

export function manifestFileNames(
  manifest: WasmAssetManifest,
): ReadonlySet<string> {
  return new Set([
    WASM_MANIFEST_NAME,
    manifest.script.name,
    manifest.wasm.name,
  ]);
}

export function wasmAssetContentType(name: string): string {
  if (name.endsWith('.wasm')) return 'application/wasm';
  if (name.endsWith('.json')) return 'application/json';
  return 'text/javascript';
}

export function sha256(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function hasWasmMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x00 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x73 &&
    bytes[3] === 0x6d
  );
}

function isAsset(value: unknown): value is WasmManifestAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<WasmManifestAsset>;
  return (
    typeof asset.name === 'string' &&
    typeof asset.path === 'string' &&
    typeof asset.sha256 === 'string' &&
    typeof asset.bytes === 'number' &&
    asset.bytes > 0
  );
}
