import { readdir, readFile } from 'node:fs/promises';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const sqliteDistUrl = new URL(
  './node_modules/@sqlite.org/sqlite-wasm/dist/',
  import.meta.url,
);
let sqliteAssetNamesPromise: Promise<ReadonlySet<string>> | undefined;

export default defineConfig({
  plugins: [sqliteWasmAssets(), sveltekit()],
  server: { allowedHosts: true },
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

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
