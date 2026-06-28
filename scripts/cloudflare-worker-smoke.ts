import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer } from 'node:net';
import { runHostedSmoke } from './hosted-smoke-core';

const outputMax = 8_192;
const port =
  Number(process.env.LKJSTR_CLOUDFLARE_SMOKE_PORT) || (await openPort());
const origin = `http://127.0.0.1:${port}`;
const worker = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--local',
    '--port',
    String(port),
    '--inspector-port',
    '0',
    '--show-interactive-dev-session=false',
  ],
  { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
);
let output = '';
worker.stdout.on('data', pushOutput);
worker.stderr.on('data', pushOutput);

try {
  await waitForWorker(worker, origin);
  await runHostedSmoke({ origin, requireNoCacheManifest: true });
  console.log(`ok cloudflare-smoke ${origin}`);
} catch (error) {
  await delay(500);
  console.error(error instanceof Error ? error.message : String(error));
  if (output) console.error(output.slice(-outputMax));
  process.exitCode = 1;
} finally {
  stopWorker(worker);
}

async function waitForWorker(
  child: ChildProcessWithoutNullStreams,
  url: string,
): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) break;
    const ready = await fetch(url).then(
      () => true,
      () => false,
    );
    if (ready) return;
    await delay(500);
  }
  throw new Error(`Cloudflare Worker did not start on ${url}`);
}

async function openPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address) resolve(address.port);
        else reject(new Error('could not reserve a smoke-test port'));
      });
    });
  });
}

function pushOutput(chunk: Buffer): void {
  output = `${output}${String(chunk)}`.slice(-outputMax);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stopWorker(child: ChildProcessWithoutNullStreams): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}
