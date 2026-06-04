import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const sqliteDistUrl = new URL(
  './node_modules/@sqlite.org/sqlite-wasm/dist/',
  import.meta.url,
);
const lkjstrWasmOut = path.join(
  repoRoot,
  'node_modules/.lkjstr/lkjstr-web-wasm',
);
let sqliteAssetNamesPromise: Promise<ReadonlySet<string>> | undefined;

export default defineConfig({
  plugins: [lkjstrWebWasmAssets(), sqliteWasmAssets(), sveltekit()],
  server: { allowedHosts: true },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

function lkjstrWebWasmAssets(): Plugin {
  let built = false;
  const names = ['lkjstr_web.js', 'lkjstr_web_bg.wasm'];
  const testHost = process.env.VITEST === 'true';
  return {
    name: 'lkjstr-web-wasm-assets',
    resolveId(id) {
      return id === 'virtual:lkjstr-web-wasm' ? '\0lkjstr-web-wasm' : null;
    },
    load(id) {
      if (id !== '\0lkjstr-web-wasm') return null;
      if (testHost) return unavailableWasmModule();
      return hostedWasmModule();
    },
    async buildStart() {
      if (!testHost)
        await buildLkjstrWebWasm(
          () => built,
          () => (built = true),
        );
    },
    async configureServer(server) {
      if (!testHost)
        await buildLkjstrWebWasm(
          () => built,
          () => (built = true),
        );
      server.middlewares.use(
        '/lkjstr-web-wasm',
        async (request, response, next) => {
          try {
            const name = new URL(
              request.url ?? '/',
              'http://localhost',
            ).pathname.replace(/^\/+/, '');
            if (!names.includes(name)) return next();
            response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
            response.setHeader('Content-Type', contentType(name));
            response.end(await readFile(path.join(lkjstrWasmOut, name)));
          } catch (error) {
            next(error as Error);
          }
        },
      );
    },
    async generateBundle() {
      if (testHost) return;
      for (const name of names) {
        this.emitFile({
          type: 'asset',
          fileName: `lkjstr-web-wasm/${name}`,
          source: await readFile(path.join(lkjstrWasmOut, name)),
        });
      }
    },
  };
}

async function buildLkjstrWebWasm(
  isBuilt: () => boolean,
  markBuilt: () => void,
): Promise<void> {
  if (isBuilt() && existsSync(path.join(lkjstrWasmOut, 'lkjstr_web.js')))
    return;
  await mkdir(lkjstrWasmOut, { recursive: true });
  const cargoPath = `${process.env.HOME ?? ''}/.cargo/bin`;
  const result = spawnSync(
    'wasm-pack',
    [
      'build',
      '--target',
      'web',
      '--out-dir',
      lkjstrWasmOut,
      '--out-name',
      'lkjstr_web',
      '--no-typescript',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${cargoPath}:${process.env.PATH ?? ''}` },
    },
  );
  if (result.status !== 0)
    throw new Error(result.stderr || result.stdout || 'wasm-pack failed');
  markBuilt();
}

function hostedWasmModule(): string {
  return `const scriptUrl = '/lkjstr-web-wasm/lkjstr_web.js';\nconst wasmUrl = '/lkjstr-web-wasm/lkjstr_web_bg.wasm';\nlet promise;\nexport async function loadLkjstrWebWasm() {\n  promise ??= import(/* @vite-ignore */ scriptUrl).then(async (module) => {\n    await module.default(wasmUrl);\n    return module;\n  });\n  return promise;\n}\n`;
}

function unavailableWasmModule(): string {
  return `export async function loadLkjstrWebWasm() {\n  throw new Error('lkjstr-web WASM is unavailable in the unit test host');\n}\n`;
}

function sqliteWasmAssets(): Plugin {
  return {
    name: 'lkjstr-sqlite-wasm-assets',
    configureServer(server) {
      server.middlewares.use('/sqlite', async (request, response, next) => {
        try {
          const path = new URL(request.url ?? '/', 'http://localhost').pathname;
          const name = path.replace(/^\/+/, '');
          if (!(await sqliteAssetNames()).has(name)) return next();
          response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
          response.setHeader('Content-Type', contentType(name));
          response.end(await readFile(new URL(name, sqliteDistUrl)));
        } catch (error) {
          next(error as Error);
        }
      });
    },
    async generateBundle() {
      for (const name of await sqliteAssetNames()) {
        this.emitFile({
          type: 'asset',
          fileName: `sqlite/${name}`,
          source: await readFile(new URL(name, sqliteDistUrl)),
        });
      }
    },
  };
}

function sqliteAssetNames(): Promise<ReadonlySet<string>> {
  sqliteAssetNamesPromise ??= readSqliteAssetNames();
  return sqliteAssetNamesPromise;
}

async function readSqliteAssetNames(): Promise<ReadonlySet<string>> {
  const entries = await readdir(sqliteDistUrl, { withFileTypes: true });
  return new Set(
    entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );
}

function contentType(name: string): string {
  if (name.endsWith('.wasm')) return 'application/wasm';
  if (name.endsWith('.mjs') || name.endsWith('.js')) return 'text/javascript';
  return 'application/octet-stream';
}
