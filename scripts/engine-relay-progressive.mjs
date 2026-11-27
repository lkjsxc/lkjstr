// Real Worker: silent-relay hedge, progressive data, bounded reads and late cancellation.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const out = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/relay-progressive-worker');
await mkdir(out, { recursive: true });
let loader = { module: '/lkjstr_engine.js', wasm: 'lkjstr_engine_bg.wasm' };
try { loader = JSON.parse(await readFile(join(pkg, 'fixture-loader.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const report = { startedAt: new Date().toISOString(), checks: [], requests: [], errors: [],
  scriptSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
  wasmSha256: createHash('sha256').update(await readFile(join(pkg, loader.wasm))).digest('hex') };
const check = (name, ok, observed) => {
  report.checks.push({ name, ok: !!ok, observed });
  console.log((ok ? 'ok ' : 'FAIL ') + name);
};
const delay = ms => new Promise(done => setTimeout(done, ms));
// worker_schedule.rs checks deadlines on 500ms settled turns.
const quietTurnMs = 500, deliveryToleranceMs = 50;
async function wait(test, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await test()) return true; await delay(25); }
  return false;
}
const matches = (event, filter) => (!filter.ids || filter.ids.includes(event.id)) &&
  (!filter.authors || filter.authors.includes(event.pubkey)) &&
  (!filter.kinds || filter.kinds.includes(event.kind)) && !filter.search &&
  (!filter.since || event.created_at >= filter.since) && (!filter.until || event.created_at <= filter.until) &&
  !Object.keys(filter).some(key => key.startsWith('#'));
const head = filter => filter.kinds?.includes(1) && !filter.ids && !filter.authors && !filter['#e'];
const boot = [
  "const queued=[];self.onmessage=e=>queued.push(e);",
  "const NativeSocket=self.WebSocket,allowed=self.location.origin.replace('http:','ws:');",
  "self.WebSocket=class extends NativeSocket{constructor(url,...rest){const u=new URL(url);if(u.origin!==allowed||!['/a','/b','/c'].includes(u.pathname))throw Error('non-owned socket');super(url,...rest);}send(text){if(!['REQ','CLOSE'].includes(JSON.parse(text)[0]))throw Error('publication blocked');super.send(text);}};",
  "const nativeFetch=self.fetch;self.fetch=(input,options)=>{if(new URL(typeof input==='string'||input instanceof URL?String(input):input.url,self.location.href).origin!==self.location.origin)throw Error('non-owned fetch');return nativeFetch(input,options);};",
  "const {default:init,start}=await import(" + JSON.stringify(loader.module) + ");await init();self.handle=start();const input=self.onmessage;for(const event of queued)input(event);",
].join('\n');
let helper, browser, server, ws, fastMode = false;
const timers = new Set();
try {
  helper = spawn(resolve(process.env.CARGO_TARGET_DIR ?? 'target', 'debug/examples/engine-fixtures'), [], { stdio: ['pipe', 'pipe', 'pipe'] });
  helper.stderr.resume();
  const lines = createInterface({ input: helper.stdout })[Symbol.asyncIterator]();
  const read = async () => {
    let timer;
    try { return JSON.parse((await Promise.race([lines.next(), new Promise((_, fail) => { timer = setTimeout(() => fail(Error('fixture signer timeout')), 5000); })])).value); }
    finally { clearTimeout(timer); }
  };
  const { note, events: metadata } = await read(), extra = [];
  for (const label of ['finite', 'cancelled']) {
    helper.stdin.write(JSON.stringify({ pubkey: note.pubkey, created_at: Math.floor(Date.now()/1000), kind: 1, tags: [], content: 'owned relay orchestration ' + label }) + '\n');
    extra.push(await read());
  }
  helper.stdin.end();
  const [finite, late] = extra;
  report.fixture = { note: note.id, finite: finite.id, late: late.id };
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fixture').pathname;
    if (path === '/') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Owned relay timing</title>');
    if (path === '/worker.js') return res.writeHead(200, { 'content-type': 'text/javascript' }).end(boot);
    if (['/a','/b','/c'].includes(path)) return res.writeHead(200, { 'content-type': 'application/nostr+json' }).end('{"limitation":{"max_subscriptions":4,"max_filters":4}}');
    if (![loader.module, '/' + loader.wasm].includes(path)) return res.writeHead(404).end();
    try { res.writeHead(200, { 'content-type': path.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' }).end(await readFile(join(pkg, basename(path)))); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = 'http://127.0.0.1:' + server.address().port;
  ws = new bundle.wsServer({ server });
  ws.on('connection', (socket, request) => {
    const route = new URL(request.url, origin).pathname, entries = new Map();
    socket.on('message', raw => {
      const [type, wire, ...filters] = JSON.parse(String(raw));
      if (type === 'CLOSE') { const entry = entries.get(wire); if (entry) { entry.closedAt ??= Date.now(); entry.closes++; } return; }
      if (type !== 'REQ') { report.errors.push('publication reached read-only fixture'); socket.terminate(); return; }
      const entry = { route, wire, filters, at: Date.now(), closes: 0, eoseAt: null, events: [] };
      report.requests.push(entry); entries.set(wire, entry);
      if (report.requests.length > 200) { report.errors.push('fixture request bound'); socket.terminate(); return; }
      const isHead = filters.some(head), isLate = filters.some(f => f.ids?.includes(late.id));
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (socket.readyState !== 1 || (entry.closedAt && !isLate)) return;
        const available = isHead ? (route === (fastMode ? '/a' : '/c') ? [note] : []) : [...metadata, finite, late];
        for (const event of available) if (filters.some(f => matches(event, f))) {
          socket.send(JSON.stringify(['EVENT', wire, event])); entry.events.push({ id: event.id, at: Date.now() });
        }
        // The second phase isolates the 300ms rule from every delivered finite page.
        if (!isHead && !fastMode) { socket.send(JSON.stringify(['EOSE', wire])); entry.eoseAt = Date.now(); }
      }, isLate ? 200 : 20);
      timers.add(timer);
    });
  });
  const cache = process.env.HOME + '/.cache/ms-playwright';
  const binary = process.env.LKJSTR_CHROME ?? join(cache, (await readdir(cache)).filter(p => p.startsWith('chromium-')).sort().pop(), 'chrome-linux64/chrome');
  browser = await chromium.launch({ executablePath: binary, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  let page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(origin);
  const startWorker = ({ origin, id, configurationDelay = 0 }) => {
    window.messages = []; window.rows = {}; window.first = {};
    window.worker = new Worker('/worker.js', { type: 'module' });
    window.worker.onerror = error => window.messages.push({ t: 'worker-error', message: error.message });
    window.worker.onmessage = ({ data: message }) => {
      window.messages.push({ ...message, at: Date.now() });
      const sub = message.sub;
      if (message.t === 'rows') window.rows[sub] = message.rows;
      if (message.t === 'patch') for (const op of message.ops) {
        const rows = window.rows[sub] ?? [];
        if (op.op === 'remove') window.rows[sub] = rows.filter(row => row.key !== op.key);
        if (op.op === 'update') window.rows[sub] = rows.map(row => row.key === op.row.key ? op.row : row);
        if (op.op === 'insert') { const index = op.before === null ? rows.length : rows.findIndex(row => row.key === op.before); rows.splice(index < 0 ? rows.length : index, 0, ...op.rows); window.rows[sub] = rows; }
      }
      if (window.rows.feed?.some(row => row.id === id)) window.first.note ??= Date.now();
      if (message.t === 'state' && sub === 'feed' && message.state.phase === 'live') window.first.ready ??= Date.now();
      if (message.t === 'ready') {
        window.worker.postMessage({ t: 'configure', config: { language: 'en', heuristics: false, prefetch: false } });
        const configureRelays = () => {
          window.beforeConfiguration = { rows: window.rows.feed?.length ?? 0,
            messages: window.messages.filter(m => m.sub === 'feed').length };
          window.first.configured = Date.now();
          window.worker.postMessage({ t: 'relays', relays: ['a','b','c'].map(path => ({ url: origin.replace('http:', 'ws:') + '/' + path, read: true, write: false, search: false })) });
        };
        if (!configurationDelay) configureRelays();
        window.first.open = Date.now();
        window.worker.postMessage({ t: 'open', sub: 'feed', query: { source: 'global' } });
        window.worker.postMessage({ t: 'hint', hint: { visibleSubs: ['feed'], focusedSub: 'feed', pageHidden: false, idle: false, saveData: false } });
        if (configurationDelay) setTimeout(configureRelays, configurationDelay);
      }
    };
  };
  await page.evaluate(startWorker, { origin, id: note.id });
  const early = await wait(() => page.evaluate(() => !!window.first.ready), 10_000);
  report.timing = await page.evaluate(() => window.first);
  const heads = report.requests.filter(r => r.filters.some(head));
  const c = heads.find(r => r.route === '/c'), first = Math.min(...heads.map(r => r.at));
  check('silent primary routes trigger the timed third route', c && c.at - first >= 300 && c.at - first < 1200, c && c.at - first);
  check('verified rows and ready state arrive without a head EOSE', early && heads.every(r => r.eoseAt === null) && report.timing.ready - report.timing.open < 1500, report.timing);
  const primaryHeads = heads.filter(r => ['/a','/b'].includes(r.route));
  const closeBudget = 5000 + quietTurnMs + deliveryToleranceMs;
  await delay(Math.max(0, Math.max(first, ...primaryHeads.map(r => r.at)) + closeBudget + deliveryToleranceMs - Date.now()));
  check('unanswered primary requests close at the five-second deadline',
    new Set(primaryHeads.map(r => r.route)).size === 2 &&
    primaryHeads.every(r => r.closes === 1 && r.closedAt >= r.at && r.closedAt - r.at <= closeBudget),
    { closeBudget, heads });
  const partial = await page.evaluate(id => ({ copies: window.rows.feed.filter(r => r.id === id).length, states: window.messages.filter(m => m.t === 'state' && m.sub === 'feed').map(m => ({ at: m.at, state: m.state })), ready: window.first.ready }), note.id);
  check('partial success survives the other route deadlines without duplicate rows', partial.copies === 1 && !partial.states.some(m => m.at > partial.ready && m.state.phase === 'failed'), partial);
  await page.evaluate(() => window.worker.postMessage({ t: 'stats', req: 'probe-stats' }));
  await page.waitForFunction(() => window.messages.some(m => m.t === 'stats' && m.req === 'probe-stats'));
  report.stats = await page.evaluate(() => window.messages.find(m => m.t === 'stats' && m.req === 'probe-stats').stats);
  check('per-relay physical uses and first-event timing are observable', report.stats.relays.some(r => r.url.endsWith('/c') && typeof r.firstEventMs === 'number') && report.stats.relays.every(r => r.requestUses === report.requests.filter(q => new URL(r.url).pathname === q.route).length), report.stats.relays);
  const open = (sub, id) => page.evaluate(({ sub, id }) => window.worker.postMessage({ t: 'open', sub, query: { source: 'thread', id } }), { sub, id });
  await open('finite', finite.id);
  check('finite signed lookup reaches the real projection', await wait(() => page.evaluate(id => window.rows.finite?.some(row => row.id === id), finite.id)));
  const finiteRequests = report.requests.filter(r => r.filters.some(f => f.ids?.includes(finite.id)));
  check('completed finite envelopes close exactly once', await wait(() => finiteRequests.length > 0 && finiteRequests.every(r => r.eoseAt !== null && r.closes === 1)), finiteRequests);
  await open('cancelled', late.id);
  if (!await wait(() => report.requests.some(r => r.filters.some(f => f.ids?.includes(late.id))))) throw Error('cancelled lookup never transmitted');
  await page.evaluate(() => window.worker.postMessage({ t: 'close', sub: 'cancelled' }));
  await delay(400);
  check('fixture actually delivered a signed late response after cancellation', report.requests.some(r => r.filters.some(f => f.ids?.includes(late.id)) && r.events.some(e => e.at > r.closedAt)));
  await open('reopened', late.id);
  await page.waitForFunction(() => window.messages.some(m => m.t === 'rows' && m.sub === 'reopened'));
  check('cancelled wire cannot populate a later cached open', await page.evaluate(id => !window.messages.find(m => m.t === 'rows' && m.sub === 'reopened').rows.some(row => row.id === id), late.id));
  await page.evaluate(() => { for (const sub of ['feed','finite','reopened']) window.worker.postMessage({ t: 'close', sub }); window.worker.postMessage({ t: 'detach' }); });
  await delay(200);
  report.workerErrors = await page.evaluate(() => window.messages.filter(m => m.t === 'worker-error'));
  await page.evaluate(() => window.worker.terminate());
  await context.close();
  fastMode = true;
  const fresh = await browser.newContext();
  await fresh.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page = await fresh.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(origin);
  const fastStart = Date.now();
  await page.evaluate(startWorker, { origin, id: note.id });
  const fastReady = await wait(() => page.evaluate(() => !!window.first.ready), 5000);
  report.fastTiming = await page.evaluate(() => window.first);
  const fastHeads = report.requests.filter(r => r.at >= fastStart && r.filters.some(head));
  const elapsed = report.fastTiming.ready - report.fastTiming.open;
  const firstFastHead = Math.min(...fastHeads.map(r => r.at));
  // The native test pins readiness at 299/300ms. The quiet Worker evaluates
  // deadlines every 500ms; bound delivery from the actual first head REQ.
  const readyBudget = 300 + quietTurnMs + deliveryToleranceMs;
  check('early verified partial data becomes ready on the 300ms deadline without EOSE',
    fastReady && report.fastTiming.note - report.fastTiming.open < 250 && elapsed >= 260 &&
    Number.isFinite(firstFastHead) && report.fastTiming.ready - firstFastHead < readyBudget &&
    report.requests.filter(r => r.at >= fastStart).every(r => r.eoseAt === null),
    { ...report.fastTiming, firstHead: firstFastHead, readyBudget });
  await delay(450);
  check('useful initial data suppresses the speculative third connection',
    !report.requests.some(r => r.at >= fastStart && r.route === '/c'), fastHeads);
  report.workerErrors.push(...await page.evaluate(() => window.messages.filter(m => m.t === 'worker-error')));
  await page.evaluate(() => { window.worker.postMessage({ t: 'close', sub: 'feed' }); window.worker.postMessage({ t: 'detach' }); });
  await delay(100);
  await page.evaluate(() => window.worker.terminate());
  await fresh.close();
  const startup = await browser.newContext();
  await startup.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  page = await startup.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(origin);
  await page.evaluate(startWorker, { origin, id: note.id, configurationDelay: 400 });
  const startupReady = await wait(() => page.evaluate(() => !!window.first.ready), 5000);
  report.startup = await page.evaluate(() => ({
    timing: window.first,
    beforeConfiguration: window.beforeConfiguration,
    states: window.messages.filter(m => m.t === 'state' && m.sub === 'feed'),
    initialRows: window.messages.find(m => m.t === 'rows' && m.sub === 'feed')?.rows.length,
  }));
  check('opening before asynchronous relay configuration never flashes failed',
    report.startup.timing.configured - report.startup.timing.open >= 350 &&
    report.startup.beforeConfiguration.rows === 0 && !report.startup.states.some(m => m.state.phase === 'failed'), report.startup);
  check('the same pending view receives verified data after configuration arrives',
    startupReady && report.startup.timing.note >= report.startup.timing.configured &&
    report.startup.timing.ready - report.startup.timing.open < 1500 &&
    await page.evaluate(id => window.rows.feed?.filter(row => row.id === id).length === 1, note.id), report.startup.timing);
  report.workerErrors.push(...await page.evaluate(() => window.messages.filter(m => m.t === 'worker-error')));
  await page.evaluate(() => { window.worker.postMessage({ t: 'close', sub: 'feed' }); window.worker.postMessage({ t: 'detach' }); });
  await delay(100);
  await page.evaluate(() => window.worker.terminate());
} catch (error) { report.failure = String(error); console.error(report.failure); }
finally {
  helper?.stdin.end();
  if (helper && helper.exitCode === null) helper.kill();
  for (const timer of timers) clearTimeout(timer);
  await browser?.close();
  if (ws) { for (const socket of ws.clients) socket.terminate(); await new Promise(done => ws.close(done)); }
  if (server?.listening) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  report.finishedAt = new Date().toISOString();
  report.ok = !report.failure && !report.errors.length && !report.workerErrors?.length && report.checks.length === 13 && report.checks.every(c => c.ok);
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ out, ok: report.ok, failure: report.failure, timing: report.timing }));
  if (!report.ok) process.exitCode = 1;
}
