import { spawn } from 'node:child_process';
import { runHostedSmoke } from './hosted-smoke-core';

const origin = 'http://127.0.0.1:5173';
const preview = spawn(
  'pnpm',
  ['preview', '--host', '0.0.0.0', '--port', '5173'],
  { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let output = '';
let exited = false;
preview.stdout.on('data', pushOutput);
preview.stderr.on('data', pushOutput);
preview.on('exit', () => {
  exited = true;
});

try {
  await waitForApp();
  console.log(`ok app-smoke ${origin}`);
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
  await runHostedSmoke({ origin, requireNoCacheManifest: false });
  return true;
}

function pushOutput(chunk: Buffer): void {
  output += String(chunk);
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
