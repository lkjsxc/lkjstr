// Manual public observation, deliberately absent from all gates. Never signs or publishes.
// Fresh local Worker + IndexedDB; a transport guard permits only REQ and CLOSE.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const npub = 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6';
const provenance = 'https://fiatjaf.com/'; // Author's own page links this nostr:npub.
const relays = ['wss://relay.damus.io/', 'wss://nos.lol/', 'wss://relay.primal.net/'];
const durationMs = 30000;
const root = resolve(process.env.LKJSTR_SAMPLE_ENGINE ?? 'tmp/engine-pkg');
const withChannels = process.env.LKJSTR_SAMPLE_CHANNELS === '1';
const allowInfo = process.env.LKJSTR_SAMPLE_NIP11 === '1';
for (const [key, dir] of Object.entries({TMPDIR:'tmp/temp', XDG_CACHE_HOME:'tmp/cache', XDG_CONFIG_HOME:'tmp/config', XDG_DATA_HOME:'tmp/data'})) {
  process.env[key] = resolve(dir);
  await mkdir(process.env[key], {recursive:true});
}
const boot = `
const allowed = new Set(${JSON.stringify(relays)});
const observed = new Map();
const ids = new Set();
const requests = [], notices = [];
const metrics = {attemptedConnections:0, connectionsOpened:0, requests:0, closes:0,
  eventsReceived:0, duplicateEvents:0, bytesIn:0, bytesOut:0, prohibitedFrames:0};
const encoder = new TextEncoder();
const NativeSocket = self.WebSocket;
self.WebSocket = new Proxy(NativeSocket, {construct(Target, args) {
  const url = new URL(args[0]).href;
  if (!allowed.has(url)) throw new Error('unconfigured relay blocked');
  const ws = new Target(...args);
  const row = observed.get(url) ?? {url, connectionsOpened:0, requests:0, eventsReceived:0,
    duplicateEvents:0, bytesIn:0, bytesOut:0, errors:0};
  observed.set(url, row); metrics.attemptedConnections++;
  ws.addEventListener('open', () => {metrics.connectionsOpened++; row.connectionsOpened++;});
  ws.addEventListener('error', () => row.errors++);
  ws.addEventListener('message', ({data}) => {
    const size = typeof data === 'string' ? encoder.encode(data).length : data.byteLength ?? data.size ?? 0;
    metrics.bytesIn += size; row.bytesIn += size;
    if (typeof data !== 'string') return;
    let frame; try {frame = JSON.parse(data);} catch {return;}
    if (['NOTICE','CLOSED'].includes(frame[0]) && notices.length < 256) notices.push({at:Date.now(),url,frame,preceding:requests.filter(r=>r.url===url).slice(-8)});
    if (frame[0] !== 'EVENT') return;
    metrics.eventsReceived++; row.eventsReceived++;
    if (ids.has(frame[2]?.id)) {metrics.duplicateEvents++; row.duplicateEvents++;}
    else if (ids.size < 20000) ids.add(frame[2]?.id);
  });
  const send = ws.send.bind(ws);
  ws.send = (data) => {
    let frame; try {frame = JSON.parse(data);} catch {frame = [];}
    if (!['REQ', 'CLOSE'].includes(frame[0])) {
      metrics.prohibitedFrames++;
      throw new Error('read-only guard blocked non-REQ/CLOSE frame');
    }
    if (frame[0] === 'REQ') {
      for (const filter of frame.slice(2)) {
        if (filter.authors?.some(author => !/^[0-9a-f]{64}$/.test(author))) {
          throw new Error('invalid public author filter blocked');
        }
      }
      metrics.requests++; row.requests++;
      if (requests.length < 512) requests.push({at:Date.now(),url,id:frame[1],filters:frame.slice(2)});
    }
    else metrics.closes++;
    const size = encoder.encode(data).length;
    metrics.bytesOut += size; row.bytesOut += size;
    send(data);
  };
  return ws;
}});
import init, {start} from './lkjstr_engine.js';
const queued = []; self.onmessage = e => queued.push(e);
await init(); self.engineHandle = start();
const input = self.onmessage;
self.onmessage = e => e.data.t === 'sample.metrics'
  ? self.postMessage({t:'sample.metrics', at:Date.now(), metrics, requests, notices, relays:[...observed.values()]}) : input(e);
for (const event of queued) self.onmessage(event);
`;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path === '/') return res.writeHead(200, {'content-type':'text/html'}).end('<!doctype html><title>Read-only engine sample</title>');
  if (path === '/worker.js') return res.writeHead(200, {'content-type':'text/javascript'}).end(boot);
  if (!['/lkjstr_engine.js', '/lkjstr_engine_bg.wasm'].includes(path)) return res.writeHead(404).end();
  try {
    const bytes = await readFile(`${root}${path}`);
    res.writeHead(200, {'content-type':path.endsWith('.wasm')?'application/wasm':'text/javascript'}).end(bytes);
  } catch {res.writeHead(404).end();}
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({executablePath:process.env.LKJSTR_CHROME, args:['--no-sandbox']});
const result = {sampledAt:new Date().toISOString(), npub, provenance, configuredRelays:relays, durationMs,
  groundTruthShare:null, publishDeliveries:null,
  limitations:['Public ground truth is unknown.', 'Publication is prohibited.', allowInfo ? 'Only NIP-11 HTTP lookups are permitted.' : 'All external HTTP is blocked.']};
try {
  const context = await browser.newContext();
  // Only local assets and guarded WebSockets. No profile-media HTTP or signer.
  await context.route('**/*', route => {
    const req = route.request();
    const info = allowInfo && req.headers().accept === 'application/nostr+json' && relays.some(r => req.url() === r.replace('wss:', 'https:'));
    return new URL(req.url()).origin === origin || info ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page.evaluate(({npub, relays}) => {
    window.sample = {channels:[], ready:false, notes:[], firstScreenMs:null, firstNoteMs:null, errors:[], stats:null, wire:null};
    const ids = new Set();
    const worker = window.worker = new Worker('/worker.js', {type:'module'});
    worker.onerror = () => window.sample.errors.push('worker-error');
    worker.onmessage = ({data:m}) => {
      const s = window.sample;
      if (m.t === 'ready') {
        s.ready = true; s.started = performance.now();
        worker.postMessage({t:'relays', relays:relays.map(url => ({url, read:true, write:false, search:false}))});
        worker.postMessage({t:'open', sub:'public-profile', query:{source:'profile', ref:npub}});
        worker.postMessage({t:'window', sub:'public-profile', anchor:'top', before:0, after:40});
      }
      if (m.t === 'stats') s.stats = m.stats;
      if (m.t === 'sample.metrics') s.wire = m;
      const rows = [...(m.rows ?? []), ...(m.ops ?? []).flatMap(op => op.row ? [op.row] : op.rows ?? [])];
      for (const row of rows) if (row.kind === 'channel' && row.creator && !s.channels.some(c=>c.id===row.id)) s.channels.push({id:row.id,name:row.name});
      for (const row of rows) if (row.kind === 'note' && !ids.has(row.id)) {
        ids.add(row.id);
        s.firstNoteMs ??= Math.round(performance.now() - s.started);
        if (ids.size >= 20) s.firstScreenMs ??= Math.round(performance.now() - s.started);
      }
      s.uniqueVerifiedNotes = ids.size;
    };
  }, {npub, relays});
  await page.waitForFunction(() => window.sample.ready, null, {timeout:15000});
  await page.waitForTimeout(durationMs);
  await page.evaluate(() => {
    window.worker.postMessage({t:'stats', req:'public-observation'});
    window.worker.postMessage({t:'close', sub:'public-profile'});
    window.worker.postMessage({t:'sample.metrics'});
  });
  await page.waitForFunction(() => window.sample.stats && window.sample.wire, null, {timeout:5000});
  const sample = await page.evaluate(() => {
    const {stats, wire, firstScreenMs, firstNoteMs, uniqueVerifiedNotes, errors} = window.sample;
    return {firstScreenMs, firstNoteMs, uniqueVerifiedNotes, errors, wire, stats};
  });
  Object.assign(result, sample);
  if (withChannels) {
    await page.evaluate(() => {
      window.worker.postMessage({t:'open',sub:'public-channels',query:{source:'channels'}});
      window.worker.postMessage({t:'window',sub:'public-channels',anchor:'top',before:0,after:50});
    });
    const channelStart = Date.now();
    await page.waitForFunction(() => window.sample.channels.length > 0, null, {timeout:135000}).catch(() => {});
    await page.waitForTimeout(2000);
    result.channelWaitMs = Date.now() - channelStart;
    await page.evaluate(() => {
      window.sample.wire = null;
      window.worker.postMessage({t:'close',sub:'public-channels'});
      window.worker.postMessage({t:'sample.metrics'});
    });
    await page.waitForFunction(() => window.sample.wire);
    result.channelSample = await page.evaluate(() => ({channels:window.sample.channels,wire:window.sample.wire}));
    if (result.channelSample.wire.metrics.prohibitedFrames) throw new Error('read-only transport guard triggered');
  }
  if (sample.wire.metrics.prohibitedFrames) throw new Error('read-only transport guard triggered');
  if (sample.errors.length) throw new Error('worker failed');
  if (sample.stats.relays.some(r => r.lastError?.includes('bad req'))) throw new Error('relay rejected malformed request');
} catch (error) {
  result.error = String(error.message).slice(0, 300);
  process.exitCode = 1;
} finally {
  await mkdir('tmp', {recursive:true});
  await writeFile(process.env.LKJSTR_SAMPLE_OUTPUT ?? 'tmp/orchestration-public.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({firstScreenMs:result.firstScreenMs, uniqueVerifiedNotes:result.uniqueVerifiedNotes,
    metrics:result.wire?.metrics, channels:result.channelSample?.channels.length, notices:result.channelSample?.wire.notices.length, error:result.error}));
  await browser.close();
  await new Promise(ok => server.close(ok));
}
