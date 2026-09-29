import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyBuiltWasmAssets } from '../../../scripts/verify-built-wasm-assets';
import { fileEvidence } from '../../../scripts/wasm-assets';

const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('static deployment WASM verification', () => {
  it('checks source and build output without Cloudflare headers', async () => {
    const root = await fixture();
    await expect(
      verifyBuiltWasmAssets({ repoRoot: root }),
    ).resolves.toBeUndefined();
  });
  it('rejects missing emitted WASM rather than checking the other target', async () => {
    const root = await fixture();
    await rm(path.join(root, 'build/lkjstr-web-wasm/bridge.wasm'));
    await expect(verifyBuiltWasmAssets({ repoRoot: root })).rejects.toThrow(
      /missing wasm asset/,
    );
  });
  it('still rejects untracked bridge imports in static output', async () => {
    const root = await fixture(true);
    await expect(verifyBuiltWasmAssets({ repoRoot: root })).rejects.toThrow(
      /untracked bridge imports/,
    );
  });
  it('does not skip source verification for static output', async () => {
    const root = await fixture();
    await rm(path.join(root, 'target/lkjstr-web-wasm/asset-manifest.json'));
    await expect(verifyBuiltWasmAssets({ repoRoot: root })).rejects.toThrow(
      /source Rust\/WASM artifacts missing/,
    );
  });
});

async function fixture(untracked = false): Promise<string> {
  vi.stubEnv('LKJSTR_ADAPTER', 'static');
  const root = await mkdtemp(path.join(tmpdir(), 'lkjstr-static-verify-'));
  roots.push(root);
  for (const output of ['target', 'build']) {
    const dir = path.join(root, output, 'lkjstr-web-wasm');
    await mkdir(dir, { recursive: true });
    const extra =
      untracked && output === 'build'
        ? "import './snippets/missing.js';\n"
        : '';
    await writeFile(
      path.join(dir, 'bridge.js'),
      `${extra}export default async function __wbg_init(wasm) { return wasm; }`,
    );
    await writeFile(
      path.join(dir, 'bridge.wasm'),
      Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
    );
    await writeFile(
      path.join(dir, 'asset-manifest.json'),
      JSON.stringify({
        generatedAt: '2026-09-29T00:00:00Z',
        target: 'web',
        script: await fileEvidence(
          dir,
          'bridge.js',
          '/lkjstr-web-wasm/bridge.js',
        ),
        wasm: await fileEvidence(
          dir,
          'bridge.wasm',
          '/lkjstr-web-wasm/bridge.wasm',
        ),
        imports: [],
      }),
    );
  }
  return root;
}
