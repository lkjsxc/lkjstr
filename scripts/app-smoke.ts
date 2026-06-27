import { spawn } from 'node:child_process';
import { hasWasmMagic, parseAssetManifest } from './wasm-assets';

const origin = 'http://127.0.0.1:5173';
const preview = spawn(
  'pnpm',
  ['preview', '--host', '0.0.0.0', '--port', '5173'],
  { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let output = '';
let exited = false;
preview.stdout.on('data', (chunk) => {
  output += chunk;
});
preview.stderr.on('data', (chunk) => {
  output += chunk;
});
preview.on('exit', () => {
  exited = true;
});

try {
  await waitForApp();
} finally {
  stopPreview();
}

async function waitForApp(): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (exited) break;
    const ok = await probe().catch(() => false);
    if (ok) return;
    await delay(1000);
  }
  throw new Error(`app smoke failed\n${output.slice(-4096)}`);
}

async function probe(): Promise<boolean> {
  const html = await fetchText('/');
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? '';
  if (body.trim().length === 0 || !html.includes('workspace-shell'))
    return false;
  const manifest = parseAssetManifest(
    await fetchText('/lkjstr-web-wasm/asset-manifest.json'),
  );
  await fetchText(manifest.script.path);
  const wasmResponse = await fetchUrl(manifest.wasm.path);
  const wasm = new Uint8Array(await wasmResponse.arrayBuffer());
  const contentType = wasmResponse.headers.get('content-type') ?? '';
  return hasWasmMagic(wasm) && acceptsWasmContentType(contentType, wasm);
}

async function fetchText(pathname: string): Promise<string> {
  const response = await fetchUrl(pathname);
  return response.text();
}

async function fetchUrl(pathname: string): Promise<Response> {
  const response = await fetch(new URL(pathname, origin));
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}`);
  return response;
}

function acceptsWasmContentType(
  contentType: string,
  wasm: Uint8Array,
): boolean {
  return contentType.includes('application/wasm') || hasWasmMagic(wasm);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopPreview(): void {
  if (!preview.pid) return;
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {
    preview.kill();
  }
}
