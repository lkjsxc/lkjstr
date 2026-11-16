// Real Worker emoji-set conformance; every socket and fixture belongs to this run.
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { loadavg } from 'node:os';
import { createInterface } from 'node:readline';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { workerBoot } from './engine-harness-boot.mjs';
import { fixtureProcess } from './engine-fixture-process.mjs';
import { validateReplies } from './engine-contract.mjs';

const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const out = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/engine-emoji');
const tmp = process.env.LKJSTR_TEST_TMPDIR ?? join(resolve(process.env.CARGO_TARGET_DIR ?? 'target', '..'), 'tmp');
await Promise.all([mkdir(out, { recursive: true }), mkdir(tmp, { recursive: true })]);
let profile;
const report = { startedAt: new Date().toISOString(), loadStart: loadavg(), package: pkg, checks: [], cleanup: {} };
report.wasmSha256 = createHash('sha256').update(await readFile(join(pkg, 'lkjstr_engine_bg.wasm'))).digest('hex');
const check = (name, ok) => { report.checks.push({ name, ok }); if (!ok) throw new Error(name); };
let context, page, signer, lines, timer, origin;
let held = [], events = [], controls = [], forbidden = 0, requestsDropped = 0;
let holdSets = true;
const matches = (event, f) => (!f.ids || f.ids.includes(event.id)) &&
  (!f.authors || f.authors.includes(event.pubkey)) && (!f.kinds || f.kinds.includes(event.kind)) &&
  (f.since === undefined || event.created_at >= f.since) && (f.until === undefined || event.created_at <= f.until) &&
  Object.entries(f).filter(([key]) => key.startsWith('#')).every(([key, values]) => event.tags.some(t => t[0] === key.slice(1) && values.includes(t[1])));
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://fixture').pathname;
  if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Emoji conformance</title>');
  if (path === '/worker.js') {
    const guard = `const Socket=globalThis.WebSocket;globalThis.WebSocket=class extends Socket{constructor(url,protocols){if(new URL(url).origin!==${JSON.stringify(origin.replace('http:', 'ws:'))})throw new Error('non-owned relay');if(protocols===undefined)super(url);else super(url,protocols);}send(text){const f=JSON.parse(text);if(!['REQ','CLOSE'].includes(f[0]))throw new Error('read-only fixture');return super.send(text);}};`;
    return res.writeHead(200, { 'content-type': 'text/javascript' }).end(guard + workerBoot('/worker.js', origin));
  }
  const file = join(pkg, path);
  if (!file.startsWith(pkg + '/')) return res.writeHead(403).end();
  try { res.writeHead(200, { 'content-type': extname(file) === '.wasm' ? 'application/wasm' : 'text/javascript' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
const sockets = new bundle.wsServer({ server });
const deliver = (ws, sub, filters) => {
  for (const f of filters) {
    const found = events.filter(e => matches(e, f)).sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id)).slice(0, f.limit ?? 200);
    for (const event of found) ws.send(JSON.stringify(['EVENT', sub, event]));
  }
  ws.send(JSON.stringify(['EOSE', sub]));
};
sockets.on('connection', ws => ws.on('message', bytes => {
  const frame = JSON.parse(bytes.toString());
  if (controls.length < 1024) controls.push({ at: Date.now(), frame }); else requestsDropped++;
  if (frame[0] === 'CLOSE') return;
  if (frame[0] !== 'REQ') { forbidden++; return ws.close(); }
  const filters = frame.slice(2);
  if (holdSets && filters.some(f => f.kinds?.includes(30030))) held.push({ ws, sub: frame[1], filters });
  else deliver(ws, frame[1], filters);
}));
async function next(value) {
  if (value !== undefined) signer.stdin.write(JSON.stringify(value) + '\n');
  const result = await lines.next();
  if (result.done) throw new Error('fixture process ended');
  return JSON.parse(result.value);
}
async function run() {
  process.env.LKJSTR_PREBUILT_FIXTURES = '1';
  signer = fixtureProcess('engine-fixtures', { stdio: ['pipe', 'pipe', 'pipe'] });
  signer.stderr.resume();
  lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
  const owner = (await next()).note.pubkey;
  const maker = (await next({ fixtureActor: true })).pubkey;
  const at = Math.floor(Date.now() / 1000);
  const sign = (pubkey, created_at, kind, tags) => next({ pubkey, created_at, kind, tags, content: '' });
  const pack = await sign(maker, at - 2, 30030, [['d', 'animals'], ['title', 'Animals'], ['emoji', 'cat', 'https://images.test/cat.png'], ['emoji', 'home', 'https://images.test/other.png']]);
  const coordinate = `30030:${maker}:animals`;
  const list = await sign(owner, at - 1, 10030, [['emoji', 'home', 'https://images.test/own.png'], ['a', coordinate]]);
  events = [pack, list];
  const base = `${process.env.HOME}/.cache/ms-playwright`;
  const binary = process.env.LKJSTR_CHROME ?? join(base, (await readdir(base)).filter(s => s.startsWith('chromium-')).sort().at(-1), 'chrome-linux64/chrome');
  context = await chromium.launchPersistentContext(profile, { executablePath: binary, headless: true, args: ['--no-sandbox'], serviceWorkers: 'block' });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.goto(origin);
  await page.evaluate(() => { window.messages = []; window.worker = new Worker('/worker.js', { type: 'module' }); window.worker.onmessage = event => window.messages.push(event.data); });
  const wait = (predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 8000 });
  const send = message => page.evaluate(m => window.worker.postMessage(m), message);
  const rows = () => page.evaluate(() => window.messages.filter(m => m.sub === 'emoji' && m.t === 'rows').at(-1));
  await wait(() => window.messages.some(m => m.t === 'ready'));
  await send({ t: 'test.relays', relays: [origin.replace('http:', 'ws:') + '/relay'] });
  await send({ t: 'open', sub: 'emoji', query: { source: 'emoji', account: owner } });
  await send({ t: 'window', sub: 'emoji', anchor: 'top', before: 0, after: 400 });
  for (let n = 0; n < 100 && !held.length; n++) await page.waitForTimeout(50);
  check('verified owner list discovers a referenced set', held.length > 0);
  const request = held.at(-1), filter = request.filters.find(f => f.kinds?.includes(30030));
  check('set lookup matches exact author and identifier', filter.authors?.length === 1 && filter.authors[0] === maker && JSON.stringify(filter['#d']) === '["animals"]' && filter.limit === 1);
  check('pending set does not claim complete membership', (await rows()).atBottom === false);
  request.ws.send(JSON.stringify(['EVENT', request.sub, { ...pack, content: 'unsigned mutation' }]));
  await page.waitForTimeout(150);
  check('unverified set cannot add a picker row', !(await rows()).rows.some(r => r.code === 'cat'));
  deliver(request.ws, request.sub, request.filters); held = [];
  await wait(() => window.messages.some(m => m.sub === 'emoji' && m.t === 'rows' && m.rows.some(r => r.code === 'cat')));
  let current = await rows();
  check('set title and code use existing EmojiRow shape', current.rows.some(r => r.key === 'emoji:cat' && r.set === 'Animals' && r.url === 'https://images.test/cat.png'));
  check('direct code wins over a referenced duplicate', current.rows.find(r => r.code === 'home')?.url === 'https://images.test/own.png');
  check('verified referenced rows finish the bounded window', current.atBottom === true);
  validateReplies(await page.evaluate(() => window.messages));
  check('emoji replies conform to the unchanged frontend protocol', true);
  const cleared = await sign(owner, at, 10030, [['emoji', 'home', 'https://images.test/own.png']]);
  events = [pack, cleared]; holdSets = false;
  await send({ t: 'close', sub: 'emoji' });
  await page.evaluate(() => { window.messages = []; });
  await send({ t: 'open', sub: 'emoji', query: { source: 'emoji', account: owner } });
  await wait(() => window.messages.some(m => m.sub === 'emoji' && m.t === 'rows' && m.rows.length === 1 && m.rows[0].code === 'home'));
  check('newest owner list withdraws an already cached set', (await rows()).rows.length === 1);
  await send({ t: 'close', sub: 'emoji' });
  await page.evaluate(() => { window.messages = []; });
  await send({ t: 'open', sub: 'emoji', query: { source: 'emoji', account: maker } });
  await wait(() => window.messages.some(m => m.sub === 'emoji' && m.t === 'rows'));
  check('another account cannot inherit cached set membership', (await rows()).rows.length === 0);
  await send({ t: 'close', sub: 'emoji' });
  check('no browser errors or forbidden relay operations', errors.length === 0 && forbidden === 0 && requestsDropped === 0);
  report.errors = errors;
}
try {
  profile = await mkdtemp(join(tmp, 'emoji-'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  await Promise.race([run(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('60-second fixture deadline')), 60000); })]);
} catch (error) { report.failure = String(error); process.exitCode = 1; }
finally {
  clearTimeout(timer);
  await context?.close().catch(() => {});
  report.cleanup.contextClosed = !context || context.pages().length === 0;
  if (signer && signer.exitCode === null && signer.signalCode === null) {
    const ended = once(signer, 'exit');
    signer.stdin.end(); signer.kill('SIGTERM');
    let reapTimer;
    await Promise.race([ended, new Promise(resolve => { reapTimer = setTimeout(resolve, 1000); })]);
    clearTimeout(reapTimer);
    if (signer.exitCode === null && signer.signalCode === null) { signer.kill('SIGKILL'); await ended; }
  }
  report.cleanup.signerExited = !signer || signer.exitCode !== null || signer.signalCode !== null;
  for (const ws of sockets.clients) ws.terminate();
  await new Promise(resolve => sockets.close(resolve));
  if (server.listening) await new Promise(resolve => server.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true });
  report.cleanup.serverClosed = !server.listening;
  report.cleanup.profileRemoved = true;
  report.finishedAt = new Date().toISOString(); report.loadEnd = loadavg();
  report.forbidden = forbidden; report.requestsDropped = requestsDropped;
  await writeFile(join(out, 'requests.json'), JSON.stringify(controls, null, 2));
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
if (report.failure) console.error(`engine-emoji: ${report.failure}`);
else console.log('ok engine-emoji');
