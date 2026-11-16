// Focused real-Worker private signer regressions. All sockets and accounts are owned loopback fixtures.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { signerFixtures } from './engine-dm-signer-fixture.mjs';
import { signerClient } from './engine-dm-signer-client.mjs';
import { receiveSignerCases, signerTimeoutCases } from './engine-dm-signer-cases.mjs';
import { archiveSignerCases } from './engine-dm-signer-archive.mjs';
import { firstLoadCases } from './engine-dm-first-load.mjs';
const before = process.argv.includes('--before');
const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const output = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/dm-signers');
await mkdir(output, {recursive:true});
process.env.TMPDIR = process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp');
await mkdir(process.env.TMPDIR, {recursive:true});
const report = {wire:[], startedAt:new Date().toISOString(), loadStart:loadavg(), package:pkg, before, firstLoadOnly:process.argv.includes('--first-load'),
  wasmSha256:createHash('sha256').update(await readFile(join(pkg,'lkjstr_engine_bg.wasm'))).digest('hex'), checks:[], evidence:{}};
function check(name, ok, observed) {
  report.checks.push({name, ok:Boolean(ok), ...(observed === undefined ? {} : {observed})});
  console.log((ok ? 'ok ' : 'FAIL ') + name + (observed === undefined ? '' : ' (' + observed + ')'));
}
const boot = `const NativeWebSocket=globalThis.WebSocket;
globalThis.WebSocket=class extends NativeWebSocket{constructor(url,protocols){
if(new URL(url).origin!==self.location.origin.replace('http:','ws:'))throw new Error('owned signer fixture blocked non-loopback socket');
super(url,protocols);}};
import init,{start} from './lkjstr_engine.js';
const queued=[];self.onmessage=e=>queued.push(e);await init();self.engineHandle=start();
const input=self.onmessage;for(const event of queued)input(event);`;
let browser, server, sockets, fixtures;
const fake = fakeRelay();
try {
  fixtures = await signerFixtures();
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://fixture').pathname;
    if (path === '/') return response.writeHead(200, {'content-type':'text/html'}).end('<!doctype html><title>Private signer fixture</title>');
    if (path === '/worker.js') return response.writeHead(200, {'content-type':'text/javascript'}).end(boot);
    if (!['/lkjstr_engine.js','/lkjstr_engine_bg.wasm'].includes(path)) return response.writeHead(404).end();
    try {
      const data = await readFile(join(pkg, path));
      response.writeHead(200, {'content-type':path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'}).end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((ok, bad) => {server.once('error', bad);server.listen(0, '127.0.0.1', ok);});
  const origin = 'http://127.0.0.1:' + server.address().port;
  sockets = new bundle.wsServer({server});
  sockets.on('connection', (socket, request) => {
    if (request.url === '/bunker') return fixtures.relay(socket);
    fake.route({send:raw => socket.readyState === 1 && socket.send(raw),
      onMessage:fn => socket.on('message', raw => {
        const msg = JSON.parse(String(raw));
        if (report.wire.length < 256) report.wire.push({at:Date.now(), command:msg[0],
          kind:msg[0] === 'EVENT' ? msg[1].kind : undefined,
          kinds:msg[0] === 'REQ' ? msg.slice(2).map(f => f.kinds) : undefined});
        fn(raw);
      }), onClose:fn => socket.on('close', fn)});
  });
  const base = process.env.HOME + '/.cache/ms-playwright';
  const binary = process.env.LKJSTR_CHROME ?? join(base, (await readdir(base))
    .filter(name => name.startsWith('chromium-')).sort().pop(), 'chrome-linux64/chrome');
  browser = await chromium.launch({executablePath:binary, args:['--no-sandbox']});
  const make = async (recipient, resetMode = true, clear = true) => {
    if (clear) { fake.stored.length = 0; fake.published.length = 0; }
    if (resetMode) fixtures.mode({});
    return signerClient({browser, origin, fixtures, fake, recipient});
  };
  if (process.argv.includes('--first-load')) {
    await firstLoadCases({make, fixtures, check});
  } else {
    await receiveSignerCases({make, fixtures, check, before, evidence:report.evidence});
  }
  if (!before && !process.argv.includes('--first-load')) {
    await archiveSignerCases({make, fixtures, check});
    await signerTimeoutCases({make, fixtures, check, evidence:report.evidence});
  }
  check('owned signer helper reported no RPC fixture errors', fixtures.calls.every(call => !call.fixtureError));
} catch (error) {
  report.failure = String(error); console.error(report.failure); process.exitCode = 1;
} finally {
  await browser?.close();
  await fixtures?.close();
  if (sockets) { for (const socket of sockets.clients) socket.terminate(); await new Promise(ok => sockets.close(ok)); }
  if (server?.listening) await new Promise(ok => server.close(ok));
  report.finishedAt = new Date().toISOString(); report.loadEnd = loadavg();
  report.ok = !report.failure && report.checks.every(check => check.ok);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (!report.ok) process.exitCode = 1;
  console.log('Private signer evidence: ' + join(output, 'report.json'));
}
