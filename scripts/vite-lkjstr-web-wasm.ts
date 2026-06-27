import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import {
  contentAddressedName,
  defaultWasmArtifactDir,
  emittedAssetManifest,
  manifestFileNames,
  publicWasmAssetPath,
  readAssetManifest,
  wasmAssetContentType,
  WASM_ASSET_DIR_NAME,
  WASM_MANIFEST_NAME,
  type WasmAssetManifest,
} from './wasm-assets';
import { LOCAL_WASM_ARTIFACT_MISSING_MESSAGE } from './wasm-toolchain';

type BuildRefs = {
  readonly scriptRef: string;
  readonly wasmRef: string;
};

type AssetEmitter = {
  emitFile(file: {
    type: 'asset';
    fileName: string;
    source: string | Buffer;
  }): string;
};

type ArtifactState =
  | { readonly available: true; readonly manifest: WasmAssetManifest }
  | { readonly available: false; readonly message: string };

export function lkjstrWebWasmAssets(repoRoot: string): Plugin {
  const artifactDir = defaultWasmArtifactDir(repoRoot);
  const testHost = process.env.VITEST === 'true';
  let config: ResolvedConfig | undefined;
  let state: ArtifactState = unavailable();
  let refs: BuildRefs | undefined;
  return {
    name: 'lkjstr-web-wasm-assets',
    configResolved(resolved) {
      config = resolved;
    },
    resolveId: (id) =>
      id === 'virtual:lkjstr-web-wasm' ? '\0lkjstr-web-wasm' : null,
    async load(id) {
      if (id !== '\0lkjstr-web-wasm') return null;
      if (testHost)
        return unavailableWasmModule('lkjstr-web WASM unavailable in tests');
      if (config?.command === 'build') {
        if (!refs) throw new Error(missingArtifactsMessage(artifactDir));
        return hostedWasmModule(refs);
      }
      state = await readArtifactState(artifactDir);
      return state.available
        ? devWasmModule(state.manifest)
        : unavailableWasmModule(state.message);
    },
    async buildStart() {
      if (testHost) return;
      state = await readArtifactState(artifactDir);
      if (!state.available && config?.command === 'build') {
        throw new Error(missingArtifactsMessage(artifactDir));
      }
      if (!state.available) {
        this.warn(state.message);
        return;
      }
      if (config?.command !== 'build') return;
      refs = await emitBridgeAssets(this, artifactDir, state.manifest);
    },
    async configureServer(server) {
      if (testHost) return;
      server.middlewares.use(
        `/${WASM_ASSET_DIR_NAME}`,
        async (request, response, next) => {
          try {
            const name = new URL(
              request.url ?? '/',
              'http://localhost',
            ).pathname.replace(/^\/+/, '');
            const manifest = await readAssetManifest(artifactDir).catch(
              () => null,
            );
            if (!manifest || !manifestFileNames(manifest).has(name))
              return next();
            response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
            response.setHeader('Cache-Control', 'no-cache');
            response.setHeader('Content-Type', wasmAssetContentType(name));
            response.end(await readFile(path.join(artifactDir, name)));
          } catch (error) {
            next(error as Error);
          }
        },
      );
    },
  };
}

async function emitBridgeAssets(
  plugin: AssetEmitter,
  artifactDir: string,
  manifest: WasmAssetManifest,
): Promise<BuildRefs> {
  const scriptName = contentAddressedName(
    manifest.script.name,
    manifest.script.sha256,
  );
  const wasmName = contentAddressedName(
    manifest.wasm.name,
    manifest.wasm.sha256,
  );
  const scriptRef = plugin.emitFile({
    type: 'asset',
    fileName: `${WASM_ASSET_DIR_NAME}/${scriptName}`,
    source: await readFile(path.join(artifactDir, manifest.script.name)),
  });
  const wasmRef = plugin.emitFile({
    type: 'asset',
    fileName: `${WASM_ASSET_DIR_NAME}/${wasmName}`,
    source: await readFile(path.join(artifactDir, manifest.wasm.name)),
  });
  const emitted = await emittedAssetManifest(
    artifactDir,
    manifest,
    scriptName,
    wasmName,
  );
  plugin.emitFile({
    type: 'asset',
    fileName: `${WASM_ASSET_DIR_NAME}/${WASM_MANIFEST_NAME}`,
    source: `${JSON.stringify(emitted, null, 2)}\n`,
  });
  return { scriptRef, wasmRef };
}

async function readArtifactState(directory: string): Promise<ArtifactState> {
  const manifestPath = path.join(directory, WASM_MANIFEST_NAME);
  if (!existsSync(manifestPath)) return unavailable();
  const manifest = await readAssetManifest(directory).catch(() => null);
  if (!manifest) return unavailable();
  if (!existsSync(path.join(directory, manifest.script.name)))
    return unavailable();
  if (!existsSync(path.join(directory, manifest.wasm.name)))
    return unavailable();
  return { available: true, manifest };
}

function hostedWasmModule(refs: BuildRefs): string {
  return wasmModule(
    `import.meta.ROLLUP_FILE_URL_${refs.scriptRef}`,
    `import.meta.ROLLUP_FILE_URL_${refs.wasmRef}`,
  );
}

function devWasmModule(manifest: WasmAssetManifest): string {
  return wasmModule(
    JSON.stringify(publicWasmAssetPath(manifest.script.name)),
    JSON.stringify(publicWasmAssetPath(manifest.wasm.name)),
  );
}

function wasmModule(scriptUrl: string, wasmUrl: string): string {
  return `const scriptUrl = ${scriptUrl};\nconst wasmUrl = ${wasmUrl};\nlet promise;\nexport async function loadLkjstrWebWasm() {\n  promise ??= import(/* @vite-ignore */ scriptUrl).then(async (module) => {\n    await module.default(wasmUrl);\n    return module;\n  });\n  return promise;\n}\n`;
}

function unavailableWasmModule(message: string): string {
  return `export async function loadLkjstrWebWasm() {\n  throw new Error(${JSON.stringify(message)});\n}\n`;
}

function unavailable(): ArtifactState {
  return { available: false, message: LOCAL_WASM_ARTIFACT_MISSING_MESSAGE };
}

function missingArtifactsMessage(directory: string): string {
  return `Rust/WASM bridge artifacts missing in ${directory}. Run pnpm rust-wasm:build before production build.`;
}
