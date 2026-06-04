import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';

type WasmBuildState =
  | { readonly available: true }
  | { readonly available: false; readonly message: string };

const assetNames = ['lkjstr_web.js', 'lkjstr_web_bg.wasm'] as const;

export function lkjstrWebWasmAssets(repoRoot: string): Plugin {
  const outDir = path.join(repoRoot, 'node_modules/.lkjstr/lkjstr-web-wasm');
  const testHost = process.env.VITEST === 'true';
  let state: WasmBuildState = unavailable('lkjstr-web WASM was not built');
  return {
    name: 'lkjstr-web-wasm-assets',
    resolveId: (id) =>
      id === 'virtual:lkjstr-web-wasm' ? '\0lkjstr-web-wasm' : null,
    load(id) {
      if (id !== '\0lkjstr-web-wasm') return null;
      if (testHost)
        return unavailableWasmModule('lkjstr-web WASM unavailable in tests');
      if (state.available || assetsReady(outDir)) return hostedWasmModule();
      return unavailableWasmModule(state.message);
    },
    async buildStart() {
      if (testHost) return;
      state = await ensureBuilt(repoRoot, outDir, state);
      if (!state.available) this.warn(state.message);
    },
    async configureServer(server) {
      if (!testHost) state = await ensureBuilt(repoRoot, outDir, state);
      server.middlewares.use(
        '/lkjstr-web-wasm',
        async (request, response, next) => {
          try {
            if (!assetsReady(outDir)) return next();
            const name = new URL(
              request.url ?? '/',
              'http://localhost',
            ).pathname.replace(/^\/+/, '');
            if (!assetNames.includes(name as (typeof assetNames)[number]))
              return next();
            response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
            response.setHeader('Content-Type', contentType(name));
            response.end(await readFile(path.join(outDir, name)));
          } catch (error) {
            next(error as Error);
          }
        },
      );
    },
    async generateBundle() {
      if (testHost || !assetsReady(outDir)) return;
      for (const name of assetNames) {
        this.emitFile({
          type: 'asset',
          fileName: `lkjstr-web-wasm/${name}`,
          source: await readFile(path.join(outDir, name)),
        });
      }
    },
  };
}

async function ensureBuilt(
  repoRoot: string,
  outDir: string,
  current: WasmBuildState,
): Promise<WasmBuildState> {
  if (current.available && assetsReady(outDir)) return current;
  if (assetsReady(outDir)) return { available: true };
  if (process.env.LKJSTR_SKIP_WASM_PACK === '1')
    return optionalFailure('wasm-pack skipped by LKJSTR_SKIP_WASM_PACK');
  await mkdir(outDir, { recursive: true });
  const result = spawnSync(wasmPackCommand(), wasmPackArgs(outDir), {
    cwd: repoRoot,
    encoding: 'utf8',
    env: buildEnv(),
  });
  if (result.error)
    return optionalFailure(`wasm-pack unavailable: ${result.error.message}`);
  if (result.status !== 0)
    return optionalFailure(
      `wasm-pack failed: ${tail(result.stderr || result.stdout)}`,
    );
  return assetsReady(outDir)
    ? { available: true }
    : optionalFailure('wasm-pack finished without emitting lkjstr-web assets');
}

function optionalFailure(message: string): WasmBuildState {
  if (process.env.LKJSTR_REQUIRE_WASM_PACK === '1') throw new Error(message);
  return unavailable(message);
}

function assetsReady(outDir: string): boolean {
  return assetNames.every((name) => existsSync(path.join(outDir, name)));
}

function wasmPackCommand(): string {
  return process.env.LKJSTR_WASM_PACK || 'wasm-pack';
}

function wasmPackArgs(outDir: string): string[] {
  return [
    'build',
    '--target',
    'web',
    '--out-dir',
    outDir,
    '--out-name',
    'lkjstr_web',
    '--no-typescript',
  ];
}

function buildEnv(): NodeJS.ProcessEnv {
  const cargoPath = `${process.env.HOME ?? ''}/.cargo/bin`;
  return { ...process.env, PATH: `${cargoPath}:${process.env.PATH ?? ''}` };
}

function hostedWasmModule(): string {
  return `const scriptUrl = '/lkjstr-web-wasm/lkjstr_web.js';\nconst wasmUrl = '/lkjstr-web-wasm/lkjstr_web_bg.wasm';\nlet promise;\nexport async function loadLkjstrWebWasm() {\n  promise ??= import(/* @vite-ignore */ scriptUrl).then(async (module) => {\n    await module.default(wasmUrl);\n    return module;\n  });\n  return promise;\n}\n`;
}

function unavailableWasmModule(message: string): string {
  return `export async function loadLkjstrWebWasm() {\n  throw new Error(${JSON.stringify(message)});\n}\n`;
}

function unavailable(message: string): WasmBuildState {
  return { available: false, message };
}

function tail(text: string): string {
  return text.slice(-4000) || 'no output';
}

function contentType(name: string): string {
  return name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
}
