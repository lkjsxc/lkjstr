import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyBuiltWasmAssets } from '../../../scripts/verify-built-wasm-assets';
import {
  fileEvidence,
  WASM_BINARY_NAME,
  WASM_MANIFEST_NAME,
  WASM_SCRIPT_NAME,
  type WasmAssetManifest,
} from '../../../scripts/wasm-assets';

let roots: string[] = [];

describe('built Rust/WASM asset verifier', () => {
  afterEach(async () => {
    await Promise.all(
      roots.map((root) => rm(root, { recursive: true, force: true })),
    );
    roots = [];
  });

  it('accepts source and Cloudflare manifests with concrete asset names', async () => {
    const root = await tempRoot();
    const sourceDir = path.join(root, 'target', 'lkjstr-web-wasm');
    const cloudflareDir = path.join(
      root,
      '.svelte-kit',
      'cloudflare',
      'lkjstr-web-wasm',
    );
    await writeVerifiedDirectory(sourceDir, WASM_SCRIPT_NAME, WASM_BINARY_NAME);
    await writeVerifiedDirectory(
      cloudflareDir,
      'lkjstr_web-abcdef1234567890.js',
      'lkjstr_web_bg-abcdef1234567890.wasm',
    );
    await writeCloudflareHeaders(cloudflareDir);

    await expect(
      verifyBuiltWasmAssets({ repoRoot: root, sourceDir, cloudflareDir }),
    ).resolves.toBeUndefined();
  });

  it('rejects invalid emitted WASM bytes', async () => {
    const root = await tempRoot();
    const sourceDir = path.join(root, 'target', 'lkjstr-web-wasm');
    const cloudflareDir = path.join(
      root,
      '.svelte-kit',
      'cloudflare',
      'lkjstr-web-wasm',
    );
    await writeVerifiedDirectory(sourceDir, WASM_SCRIPT_NAME, WASM_BINARY_NAME);
    await writeVerifiedDirectory(
      cloudflareDir,
      'lkjstr_web-abcdef1234567890.js',
      'lkjstr_web_bg-abcdef1234567890.wasm',
      Buffer.from([1, 2, 3, 4]),
    );
    await writeCloudflareHeaders(cloudflareDir);

    await expect(
      verifyBuiltWasmAssets({ repoRoot: root, sourceDir, cloudflareDir }),
    ).rejects.toThrow(/invalid WASM bytes/);
  });

  it('rejects untracked bridge imports', async () => {
    const root = await tempRoot();
    const sourceDir = path.join(root, 'target', 'lkjstr-web-wasm');
    const cloudflareDir = path.join(
      root,
      '.svelte-kit',
      'cloudflare',
      'lkjstr-web-wasm',
    );
    await writeVerifiedDirectory(sourceDir, WASM_SCRIPT_NAME, WASM_BINARY_NAME);
    await writeVerifiedDirectory(
      cloudflareDir,
      'lkjstr_web-abcdef1234567890.js',
      'lkjstr_web_bg-abcdef1234567890.wasm',
      Buffer.from([0, 97, 115, 109, 1]),
      true,
    );
    await writeCloudflareHeaders(cloudflareDir);

    await expect(
      verifyBuiltWasmAssets({ repoRoot: root, sourceDir, cloudflareDir }),
    ).rejects.toThrow(/untracked bridge imports/);
  });

  it('rejects missing manifest cache header emission', async () => {
    const root = await tempRoot();
    const sourceDir = path.join(root, 'target', 'lkjstr-web-wasm');
    const cloudflareDir = path.join(
      root,
      '.svelte-kit',
      'cloudflare',
      'lkjstr-web-wasm',
    );
    await writeVerifiedDirectory(sourceDir, WASM_SCRIPT_NAME, WASM_BINARY_NAME);
    await writeVerifiedDirectory(
      cloudflareDir,
      'lkjstr_web-abcdef1234567890.js',
      'lkjstr_web_bg-abcdef1234567890.wasm',
    );

    await expect(
      verifyBuiltWasmAssets({ repoRoot: root, sourceDir, cloudflareDir }),
    ).rejects.toThrow(/_headers missing/);
  });
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'lkjstr-wasm-verify-'));
  roots.push(root);
  return root;
}

async function writeCloudflareHeaders(cloudflareDir: string): Promise<void> {
  await writeFile(
    path.join(path.dirname(cloudflareDir), '_headers'),
    '/lkjstr-web-wasm/asset-manifest.json\n  Cache-Control: no-cache\n',
  );
}

async function writeVerifiedDirectory(
  directory: string,
  scriptName: string,
  wasmName: string,
  wasm = Buffer.from([0, 97, 115, 109, 1]),
  withUntrackedImport = false,
): Promise<void> {
  await mkdir(directory, { recursive: true });
  const importLine = withUntrackedImport
    ? "import './snippets/missing.js';\n"
    : '';
  await writeFile(
    path.join(directory, scriptName),
    `${importLine}export default async function __wbg_init(input) { return input; }\n`,
  );
  await writeFile(path.join(directory, wasmName), wasm);
  const manifest: WasmAssetManifest = {
    generatedAt: '2026-06-27T00:00:00.000Z',
    target: 'web',
    script: await fileEvidence(
      directory,
      scriptName,
      `/lkjstr-web-wasm/${scriptName}`,
    ),
    wasm: await fileEvidence(
      directory,
      wasmName,
      `/lkjstr-web-wasm/${wasmName}`,
    ),
    imports: [],
  };
  await writeFile(
    path.join(directory, WASM_MANIFEST_NAME),
    `${JSON.stringify(manifest)}\n`,
  );
}
