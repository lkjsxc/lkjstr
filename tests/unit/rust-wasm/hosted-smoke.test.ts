import { describe, expect, it } from 'vitest';
import { runHostedSmoke } from '../../../scripts/hosted-smoke-core';
import { sha256, type WasmAssetManifest } from '../../../scripts/wasm-assets';

type Route = {
  readonly body: BodyInit | null;
  readonly status?: number;
  readonly headers?: HeadersInit;
};

const encoder = new TextEncoder();
const script = encoder.encode(
  'export default async function __wbg_init() { return "wasm"; }\n',
);
const wasm = Uint8Array.from([0, 97, 115, 109, 1]);
const manifest: WasmAssetManifest = {
  generatedAt: '2026-06-28T00:00:00.000Z',
  target: 'web',
  script: {
    name: 'lkjstr_web-abcdef1234567890.js',
    path: '/lkjstr-web-wasm/lkjstr_web-abcdef1234567890.js',
    bytes: script.length,
    sha256: sha256(script),
  },
  wasm: {
    name: 'lkjstr_web_bg-abcdef1234567890.wasm',
    path: '/lkjstr-web-wasm/lkjstr_web_bg-abcdef1234567890.wasm',
    bytes: wasm.length,
    sha256: sha256(wasm),
  },
};

describe('hosted smoke checks', () => {
  it('accepts a valid production-style root and bridge asset set', async () => {
    await expect(
      runHostedSmoke({ origin: origin(), fetchImpl: routes() }),
    ).resolves.toBeUndefined();
  });

  it('rejects a root Worker failure', async () => {
    await expect(
      runHostedSmoke({
        origin: origin(),
        fetchImpl: routes({
          '/': {
            status: 500,
            body: '<h1>500</h1> <p>Internal Error</p>',
            headers: { 'content-type': 'text/html' },
          },
        }),
      }),
    ).rejects.toThrow(/returned 500/);
  });

  it('rejects stale-cache-prone manifest headers', async () => {
    await expect(
      runHostedSmoke({
        origin: origin(),
        fetchImpl: routes({
          '/lkjstr-web-wasm/asset-manifest.json': manifestRoute({}),
        }),
      }),
    ).rejects.toThrow(/Cache-Control/);
  });

  it('rejects root fallback for missing bridge assets', async () => {
    await expect(
      runHostedSmoke({
        origin: origin(),
        fetchImpl: routes({
          '/lkjstr-web-wasm/__missing__.wasm': {
            status: 200,
            body: '<html>fallback</html>',
            headers: { 'content-type': 'text/html' },
          },
        }),
      }),
    ).rejects.toThrow(/missing bridge asset/);
  });
});

function origin(): string {
  return 'https://lkjstr.test';
}

function routes(overrides: Record<string, Route> = {}): typeof fetch {
  const base: Record<string, Route> = {
    '/': {
      body: '<html><script src="/_app/immutable/entry/start.js"></script></html>',
      headers: { 'content-type': 'text/html' },
    },
    '/lkjstr-web-wasm/asset-manifest.json': manifestRoute({
      'cache-control': 'no-cache',
    }),
    [manifest.script.path]: {
      body: script,
      headers: { 'content-type': 'text/javascript' },
    },
    [manifest.wasm.path]: {
      body: wasm,
      headers: { 'content-type': 'application/wasm' },
    },
    '/lkjstr-web-wasm/__missing__.wasm': {
      status: 404,
      body: 'not found',
      headers: { 'content-type': 'text/html' },
    },
    ...overrides,
  };
  return async (input) => {
    const route = base[new URL(String(input)).pathname];
    if (!route) return new Response('not found', { status: 404 });
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: route.headers,
    });
  };
}

function manifestRoute(headers: HeadersInit): Route {
  return {
    body: JSON.stringify(manifest),
    headers: { 'content-type': 'application/json', ...headers },
  };
}
