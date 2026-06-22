import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { lkjstrWebWasmAssets } from '../../../scripts/vite-lkjstr-web-wasm';
import { rustWasmArtifactMissingMessage } from '../../../src/lib/rust-wasm/bridge-unavailable';

type ViteWasmTestPlugin = {
  configResolved(config: { readonly command: 'serve' | 'build' }): void;
  buildStart: {
    call(context: { warn(message: string): void }): Promise<void> | void;
  };
  load(
    id: string,
  ): Promise<string | null | undefined> | string | null | undefined;
};

const originalWasmPack = process.env.LKJSTR_WASM_PACK;
const originalVitest = process.env.VITEST;

describe('Vite Rust/WASM asset plugin', () => {
  afterEach(() => {
    process.env.LKJSTR_WASM_PACK = originalWasmPack;
    process.env.VITEST = originalVitest;
  });

  it('keeps missing wasm-pack out of the browser virtual module in dev', async () => {
    const root = await tempRoot();
    process.env.VITEST = 'false';
    process.env.LKJSTR_WASM_PACK = 'definitely-missing-wasm-pack-for-lkjstr';
    const warnings: string[] = [];
    const plugin = lkjstrWebWasmAssets(root) as unknown as ViteWasmTestPlugin;
    plugin.configResolved({ command: 'serve' });
    await plugin.buildStart.call({
      warn: (message: string) => warnings.push(message),
    });
    const code = String(await plugin.load('\0lkjstr-web-wasm'));
    await rm(root, { recursive: true, force: true });

    expect(warnings.join('\n')).toContain(
      'Missing required Rust/WASM build tool',
    );
    expect(code).toContain(rustWasmArtifactMissingMessage);
    expect(code).not.toContain('spawnSync');
    expect(code).not.toContain('ENOENT');
  });

  it('fails production build with actionable missing wasm-pack text', async () => {
    const root = await tempRoot();
    process.env.VITEST = 'false';
    process.env.LKJSTR_WASM_PACK = 'definitely-missing-wasm-pack-for-lkjstr';
    const plugin = lkjstrWebWasmAssets(root) as unknown as ViteWasmTestPlugin;
    plugin.configResolved({ command: 'build' });
    await expect(
      plugin.buildStart.call({ warn: () => undefined }),
    ).rejects.toThrow(/Missing required Rust\/WASM build tool/);
    await rm(root, { recursive: true, force: true });
  });
});

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'lkjstr-wasm-plugin-'));
}
