import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBuildManifest } from '../../../scripts/build-lkjstr-web-wasm';
import {
  WASM_BINARY_NAME,
  WASM_SCRIPT_NAME,
} from '../../../scripts/wasm-assets';

let roots: string[] = [];

describe('explicit Rust/WASM artifact builder helpers', () => {
  afterEach(async () => {
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true })),
    );
    roots = [];
  });

  it('creates manifest evidence for real bridge files', async () => {
    const root = await tempRoot();
    const artifactDir = path.join(root, 'target', 'lkjstr-web-wasm');
    await writeBridgeFiles(artifactDir, Buffer.from([0, 97, 115, 109, 1]));

    const manifest = await createBuildManifest(
      root,
      artifactDir,
      '2026-06-27T00:00:00.000Z',
    );

    expect(manifest.target).toBe('web');
    expect(manifest.script.name).toBe(WASM_SCRIPT_NAME);
    expect(manifest.script.bytes).toBeGreaterThan(0);
    expect(manifest.wasm.name).toBe(WASM_BINARY_NAME);
    expect(manifest.wasm.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.imports).toEqual([]);
  });

  it('tracks wasm-bindgen snippet imports as required assets', async () => {
    const root = await tempRoot();
    const artifactDir = path.join(root, 'target', 'lkjstr-web-wasm');
    await writeBridgeFiles(
      artifactDir,
      Buffer.from([0, 97, 115, 109, 1]),
      true,
    );

    const manifest = await createBuildManifest(
      root,
      artifactDir,
      '2026-06-27T00:00:00.000Z',
    );

    expect(manifest.imports.map((item) => item.name)).toEqual([
      'snippets/lkjstr-web/inline0.js',
    ]);
  });

  it('rejects invalid WASM bytes before writing build evidence', async () => {
    const root = await tempRoot();
    const artifactDir = path.join(root, 'target', 'lkjstr-web-wasm');
    await writeBridgeFiles(artifactDir, Buffer.from([1, 2, 3, 4]));

    await expect(
      createBuildManifest(root, artifactDir, '2026-06-27T00:00:00.000Z'),
    ).rejects.toThrow(/invalid lkjstr_web_bg\.wasm/);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'lkjstr-wasm-build-'));
  roots.push(root);
  return root;
}

async function writeBridgeFiles(
  artifactDir: string,
  wasm: Buffer,
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
  const snippet = withSnippet
    ? "import './snippets/lkjstr-web/inline0.js';\n"
    : '';
  await writeFile(
    path.join(artifactDir, WASM_SCRIPT_NAME),
    `${snippet}export default async function __wbg_init(input) { return input; }\n`,
  );
  await writeFile(path.join(artifactDir, WASM_BINARY_NAME), wasm);
}
