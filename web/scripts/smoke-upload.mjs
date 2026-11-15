// Standalone real-upload matrix, also run by the ordinary smoke gate.
import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeBunker } from '../../scripts/browser-bunker.mjs';
import { fakeMediaSet } from '../../scripts/browser-media.mjs';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { uploadScenarios } from './smoke-uploads.mjs';

const root = new URL('../../', import.meta.url).pathname;
process.chdir(root);
for (const [key, path] of Object.entries({
  CARGO_HOME: 'cargo-home',
  XDG_CACHE_HOME: 'cache',
  XDG_CONFIG_HOME: 'config',
  XDG_DATA_HOME: 'data',
  TMPDIR: 'temp',
}))
  process.env[key] ??= `${root}tmp/${path}`;
process.env.CARGO_BUILD_JOBS = '4';
process.env.RUST_TEST_THREADS = '4';
await mkdir(process.env.TMPDIR, { recursive: true });
const signer = spawn('cargo', ['run', '-q', '-p', 'lkjstr-core', '--example', 'engine-fixtures'], {
  stdio: ['pipe', 'pipe', 'pipe'],
});
signer.stderr.resume();
const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
const fixture = JSON.parse((await lines.next()).value);
let chain = Promise.resolve();
const sign = (event) => {
  const work = chain.then(async () => {
    signer.stdin.write(JSON.stringify(event) + '\n');
    return JSON.parse((await lines.next()).value);
  });
  chain = work.then(() => {});
  return work;
};
const fake = fakeRelay(),
  bunker = await fakeBunker(),
  media = await fakeMediaSet();
for (const e of [fixture.note, ...fixture.events]) fake.add(e);
const relay = createServer(),
  ws = new bundle.wsServer({ server: relay });
ws.on('connection', (socket, req) => {
  if (req.url === '/bunker') return bunker.route(socket);
  fake.route({
    send: (text) => socket.send(text),
    onMessage: (fn) => socket.on('message', fn),
    onClose: (fn) => socket.on('close', fn),
  });
});
await new Promise((done) => relay.listen(0, '127.0.0.1', done));
const relayUrl = `ws://127.0.0.1:${relay.address().port}`;
const server = spawn(
  process.execPath,
  [
    'web/scripts/serve.ts',
    '--port=0',
    `--test-relay=${relayUrl}`,
    `--test-media=${Object.values(media.origins).join(',')}`,
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
const errors = [],
  checks = [];
let browser;
try {
  const base = await new Promise((done, fail) => {
    server.stdout.once('data', (data) => done(String(data).trim()));
    server.once('exit', () => fail(new Error('static server exited')));
  });
  browser = await chromium.launch({
    executablePath:
      process.env.LKJSTR_CHROME ??
      `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
    args: ['--no-sandbox', '--disable-background-networking', '--ignore-certificate-errors'],
  });
  const check = (name, ok = true) => {
    if (!ok) throw new Error(name);
    checks.push(name);
    appendFileSync('tmp/smoke-uploads-progress.log', `ok ${name}\n`);
  };
  await uploadScenarios({
    quick: true,
    browser,
    base,
    relayUrl,
    pubkey: fixture.note.pubkey,
    sign,
    errors,
    check,
    fake,
    bunker,
    media,
  });
  check('no upload page errors', errors.length === 0);
  console.log(`ok smoke-uploads (${checks.length})`);
} finally {
  await browser?.close();
  server.kill();
  signer.stdin.end();
  await bunker.close();
  await media.close();
  ws.close();
  await new Promise((done) => relay.close(done));
}
