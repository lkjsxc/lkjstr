import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBuildManifest } from '../../../scripts/build-lkjstr-web-wasm';
import { lkjstrWebWasmAssets } from '../../../scripts/vite-lkjstr-web-wasm';
import { rustWasmArtifactMissingMessage } from '../../../src/lib/rust-wasm/bridge-unavailable';

type EmittedAsset = {
  readonly fileName: string;
  readonly source: string | Buffer;
};
type ViteWasmTestPlugin = {
  configResolved(config: { readonly command: 'serve' | 'build' }): void;
  buildStart: { call(context: TestContext): Promise<void> | void };
  load(
    id: string,
  ): Promise<string | null | undefined> | string | null | undefined;
};
type TestContext = {
  warn(message: string): void;
  emitFile(file: {
    type: 'asset';
    fileName: string;
    source: string | Buffer;
  }): string;
};

const originalDir = process.env.LKJSTR_WEB_WASM_DIR;
const originalVitest = process.env.VITEST;

describe('Vite Rust/WASM asset plugin', () => {
  afterEach(() => {
    process.env.LKJSTR_WEB_WASM_DIR = originalDir;
    process.env.VITEST = originalVitest;
  });

  it('keeps missing artifacts out of the browser virtual module in dev', async () => {
    const root = await tempRoot();
    process.env.VITEST = 'false';
    process.env.LKJSTR_WEB_WASM_DIR = path.join(root, 'missing');
    const warnings: string[] = [];
    const plugin = lkjstrWebWasmAssets(root) as unknown as ViteWasmTestPlugin;
    plugin.configResolved({ command: 'serve' });
    await plugin.buildStart.call(testContext(warnings, []));
    const code = String(await plugin.load('\0lkjstr-web-wasm'));
    await rm(root, { recursive: true, force: true });

    expect(warnings.join('\n')).toContain(rustWasmArtifactMissingMessage);
    expect(code).toContain(rustWasmArtifactMissingMessage);
    expect(code).toContain('closeLkjstrWebWasmStorageIfLoaded');
    expect(code).not.toContain('spawnSync');
    expect(code).not.toContain('ENOENT');
  });

  it('fails production build when prebuilt artifacts are absent', async () => {
    const root = await tempRoot();
    process.env.VITEST = 'false';
    process.env.LKJSTR_WEB_WASM_DIR = path.join(root, 'missing');
    const plugin = lkjstrWebWasmAssets(root) as unknown as ViteWasmTestPlugin;
    plugin.configResolved({ command: 'build' });
    await expect(plugin.buildStart.call(testContext([], []))).rejects.toThrow(
      /Run pnpm rust-wasm:build/,
    );
    await rm(root, { recursive: true, force: true });
  });

  it('emits existing bridge assets without invoking the toolchain', async () => {
    const root = await tempRoot();
    const artifactDir = path.join(root, 'target', 'lkjstr-web-wasm');
    await writeArtifacts(root, artifactDir);
    process.env.VITEST = 'false';
    process.env.LKJSTR_WEB_WASM_DIR = artifactDir;
    const emitted: EmittedAsset[] = [];
    const plugin = lkjstrWebWasmAssets(root) as unknown as ViteWasmTestPlugin;
    plugin.configResolved({ command: 'build' });
    await plugin.buildStart.call(testContext([], emitted));
    const code = String(await plugin.load('\0lkjstr-web-wasm'));
    await rm(root, { recursive: true, force: true });

    expect(emitted.map((asset) => asset.fileName)).toContain(
      'lkjstr-web-wasm/asset-manifest.json',
    );
    expect(
      emitted.some((asset) => /lkjstr_web-[a-f0-9]+\.js$/.test(asset.fileName)),
    ).toBe(true);
    expect(code).toContain('/lkjstr-web-wasm/lkjstr_web-');
    expect(code).not.toContain('import.meta.ROLLUP_FILE_URL_');
    expect(code).toContain('module.default({ module_or_path: wasmUrl })');
    expect(code).toContain('if (!promise) return 0');
    expect(code).toContain('close_sqlite_storage_for_reset');
    expect(code).not.toContain('wasm-pack');
    expect(code).not.toContain('spawnSync');
  });

  it('emits tracked wasm-bindgen snippet imports', async () => {
    const root = await tempRoot();
    const artifactDir = path.join(root, 'target', 'lkjstr-web-wasm');
    await writeArtifacts(root, artifactDir, true);
    process.env.VITEST = 'false';
    process.env.LKJSTR_WEB_WASM_DIR = artifactDir;
    const emitted: EmittedAsset[] = [];
    const plugin = lkjstrWebWasmAssets(root) as unknown as ViteWasmTestPlugin;
    plugin.configResolved({ command: 'build' });
    await plugin.buildStart.call(testContext([], emitted));
    await rm(root, { recursive: true, force: true });

    expect(emitted.map((asset) => asset.fileName)).toContain(
      'lkjstr-web-wasm/snippets/lkjstr-web/inline0.js',
    );
  });

  it('keeps the plugin source free of child process toolchain calls', async () => {
    const source = await readFile('scripts/vite-lkjstr-web-wasm.ts', 'utf8');
    expect(source).not.toContain('node:child_process');
    expect(source).not.toContain('spawnSync');
  });
});

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'lkjstr-wasm-plugin-'));
}

async function writeArtifacts(
  root: string,
  artifactDir: string,
  withSnippet = false,
): Promise<void> {
  await mkdir(artifactDir, { recursive: true });
  if (withSnippet) {
    await mkdir(path.join(artifactDir, 'snippets', 'lkjstr-web'), {
      recursive: true,
    });
    await writeFile(
      path.join(artifactDir, 'snippets', 'lkjstr-web', 'inline0.js'),
      'export function owner() { return true; }\n',
    );
  }
  await writeFile(
    path.join(artifactDir, 'lkjstr_web.js'),
    wasmBindgenJs(withSnippet),
  );
  await writeFile(
    path.join(artifactDir, 'lkjstr_web_bg.wasm'),
    Buffer.from([0, 97, 115, 109, 1]),
  );
  const manifest = await createBuildManifest(
    root,
    artifactDir,
    '2026-06-27T00:00:00.000Z',
  );
  await writeFile(
    path.join(artifactDir, 'asset-manifest.json'),
    `${JSON.stringify(manifest)}\n`,
  );
}

function testContext(warnings: string[], emitted: EmittedAsset[]): TestContext {
  return {
    warn: (message) => warnings.push(message),
    emitFile: (file) => {
      emitted.push({ fileName: file.fileName, source: file.source });
      return `ref${emitted.length}`;
    },
  };
}

function wasmBindgenJs(withSnippet = false): string {
  const snippet = withSnippet
    ? "import './snippets/lkjstr-web/inline0.js';\n"
    : '';
  return `${snippet}export default async function __wbg_init(input) { return input; }\n`;
}
