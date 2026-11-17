// Harness correctness: invalid samples cannot win; public identity and outbound guard fail closed.
import { once } from 'node:events';
import bundle from 'playwright-core/lib/utilsBundle';
import { attachRace } from './race-cdp.mjs';
import { throttlePhone, phoneNetwork } from './race-phone.mjs';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defaultNpub, publicIdentity, median, summarise, foundationWitnesses } from './race-report.mjs';
import { installReadonly } from './race-guard.mjs';
import { openBrowser } from './race-profile.mjs';
import { scheduleRace } from './race-schedule.mjs';
import { resolverRules, sshArguments, validateProbe } from './race-route.mjs';
import { startStatic } from './race-server.mjs';
let checks = 0;
const test = async fn => { await fn(); checks++; };
await test(() => assert.equal(publicIdentity(publicIdentity(defaultNpub).pubkey).npub, defaultNpub));
await test(() => assert.throws(() => publicIdentity(defaultNpub.slice(0, -1) + 'q'), /checksum/));
await test(() => assert.throws(() => publicIdentity('nsec1' + 'a'.repeat(58)), /Only npub/));
await test(() => assert.equal(median([1, 5, 3, 2, 4], 5), 3));
await test(() => assert.equal(median([1, 2, 3, 4], 5), null));
await test(() => assert.equal(median([1, 2, 3, 4, undefined], 5), null));
await test(() => {
  const runs = Array.from({ length: 5 }, (_, index) => ({ site: 'lkjstr', scenario: 'cold', index, validReadOnly: true,
    dom: { marks: { firstNoteMs: index + 1 } }, provenance: {} }));
  runs[4].failure = 'guard missing';
  const summary = summarise({ runs, requestedRuns: 5 })[0];
  assert.equal(summary.valid, 4); assert.equal(summary.firstNoteMs, null);
});
await test(() => {
  const sent = [];
  function Socket() { this.addEventListener = () => {}; }
  Socket.prototype.send = raw => sent.push(raw);
  const context = { WebSocket: Socket, performance: { timeOrigin: 1, now: () => 1 }, URL, Blob, Map, Error, JSON, Proxy, Reflect };
  runInNewContext('(' + installReadonly.toString() + ')()', context);
  const socket = new context.WebSocket('wss://example.invalid');
  socket.send(JSON.stringify(['REQ', 'read', { kinds: [1] }]));
  assert.throws(() => socket.send(JSON.stringify(['EVENT', { content: 'must never leave' }])), /read requests/);
  assert.throws(() => socket.send(JSON.stringify(['AUTH', {}])), /read requests/);
  assert.throws(() => socket.send('binary'), /non-JSON/);
  assert.equal(sent.length, 1); assert.equal(context.__openRaceGuard.forbidden, 3);
});
await test(() => {
  assert.equal(resolverRules(43210), 'MAP lkjsxc.com 127.0.0.1:43210, MAP lkjstr.lkjsxc.com 127.0.0.1:43210');
  assert.throws(() => resolverRules(0), /Invalid/); assert.throws(() => resolverRules('443'), /Invalid/);
  const args = sshArguments(43210);
  assert.deepEqual(args.slice(0, 4), ['-N', '-T', '-S', 'none']);
  for (const value of ['ControlMaster=no', 'ControlPersist=no', 'BatchMode=yes', 'ExitOnForwardFailure=yes',
    '127.0.0.1:43210:10.203.47.10:443', 'root@archserver']) assert.ok(args.includes(value));
});
await test(() => {
  const valid = { http_code: 200, ssl_verify_result: 0, url_effective: 'https://lkjsxc.com/public',
    num_redirects: 0, content_type: 'image/png' };
  validateProbe(valid, 'image/png');
  for (const patch of [{ http_code: 404 }, { ssl_verify_result: 60 }, { num_redirects: 1 },
    { url_effective: 'http://lkjsxc.com/public' }, { content_type: 'text/html' }])
    assert.throws(() => validateProbe({ ...valid, ...patch }, 'image/png'), /valid-TLS/);
});
await test(async () => {
  const report = {};
  await assert.rejects(scheduleRace({ directory: 'unused', report, stopRequested: () => true }), /interrupted/);
  assert.deepEqual(report.foundations, {});
});
await test(async () => {
  const server = new bundle.wsServer({ host: '127.0.0.1', port: 0 });
  let peer, observer;
  server.on('connection', socket => {
    peer = socket;
    socket.on('message', raw => { const message = JSON.parse(String(raw)); socket.send(JSON.stringify({ id: message.id, result: {} })); });
  });
  try {
    await once(server, 'listening');
    observer = await attachRace('ws://127.0.0.1:' + server.address().port);
    const seen = [];
    let resolveEvent;
    const eventArrived = new Promise(done => { resolveEvent = done; });
    const dispose = observer.listenNetwork(event => { seen.push(event); resolveEvent(); });
    const removers = Array.from({ length: 7 }, () => observer.listenNetwork(() => {}));
    assert.throws(() => observer.listenNetwork(() => {}), /maximum eight/);
    for (const remove of removers) remove();
    peer.send(JSON.stringify({ method: 'Network.webSocketFrameReceived', sessionId: 'worker',
      params: { response: { payloadData: '["EOSE","public"]' } } }));
    const timer = setTimeout(() => resolveEvent(), 1000);
    await eventArrived; clearTimeout(timer);
    assert.equal(seen.length, 1); assert.equal(seen[0].sessionId, 'worker');
    assert.equal(seen[0].params.response.payloadData, '["EOSE","public"]');
    assert.ok(Number.isFinite(seen[0].observedAt));
    assert.equal((await observer.sample()).websocketReceivedPayloadBytes, 0); // Listener works before aggregate start.
    dispose();
    peer.send(JSON.stringify({ method: 'Network.loadingFinished', params: { requestId: 'unused', encodedDataLength: 0 } }));
    await new Promise(done => setTimeout(done, 20)); assert.equal(seen.length, 1);
  } finally { await observer?.close(); await new Promise(done => server.close(done)); }
});
await test(async () => assert.rejects(openBrowser('unused-route-profile', { site: 'nostter', hostResolverRules: resolverRules(43210) }), /requires the measured app origin/));
for (const type of ['page', 'worker', 'shared_worker', 'service_worker']) await test(async () => {
  const calls = [];
  const witness = await throttlePhone(async (method, params, session) => {
    calls.push({ method, params, session });
    if (method === 'Network.emulateNetworkConditionsByRule') return { ruleIds: ['actual-rule'] };
    assert.notEqual(method, 'Network.emulateNetworkConditions');
    return {};
  }, 'owned-target', type);
  assert.equal(witness.ruleIds[0], 'actual-rule');
  assert.deepEqual(calls[0].params, { offline: false, matchedNetworkConditions: [{
    urlPattern: '', latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' }] });
  assert.ok(calls.every(call => call.session === 'owned-target'));
  assert.equal(calls.some(call => call.method === 'Network.overrideNetworkState'), type !== 'worker');
  assert.equal(calls.some(call => call.method === 'Emulation.setCPUThrottlingRate'), type === 'page');
  assert.equal(witness.conditions.downloadThroughput, phoneNetwork.downloadThroughput);
});
await test(async () => assert.rejects(throttlePhone(async () => ({}), 'target', 'worker'), /rule witness/));
await test(async () => assert.rejects(throttlePhone(async () => { throw Error('unsupported shaping'); }, 'target', 'worker'), /unsupported shaping/));
const foundationReport = () => ({
  finished: '2026-11-17T01:24:34Z', complete: false, account: publicIdentity(defaultNpub),
  foundations: Object.fromEntries(['nostter', 'lkjstr'].map(site => [site, { lastClosed: '2026-11-17T01:22:00Z' }])),
  runs: ['nostter', 'lkjstr'].map(site => ({ site, scenario: 'five-minute', index: 5,
    finished: '2026-11-17T01:22:00Z', validReadOnly: true, profile: { readOnly: true },
    network: { forbiddenSentFrames: 0, guards: [{ type: 'page', guard: { forbidden: 0 } }] } })),
});
await test(() => {
  const report = foundationReport();
  report.runs.push({ site: 'nostter', scenario: 'phone-cold', failure: 'unsupported instrumentation' });
  const witnesses = foundationWitnesses(report);
  assert.equal(witnesses.length, 2); assert.ok(witnesses.every(item => item.matrixComplete === false));
  assert.equal(report.complete, false); // Reuse never rewrites the failed matrix.
});
for (const damage of [
  report => { delete report.finished; },
  report => { report.cleanupFailure = ['listener remained']; },
  report => { report.foundations.lkjstr.lastClosed = 'unobserved close'; },
  report => { report.runs[0].profile.readOnly = false; },
  report => { report.runs[0].failure = 'incomplete account witness'; },
  report => { report.runs[0].network.guards[0].guard.forbidden = 1; },
  report => { report.runs[0].network.forbiddenSentFrames = 1; },
]) await test(() => { const report = foundationReport(); damage(report); assert.throws(() => foundationWitnesses(report)); });
const directory = await mkdtemp(resolve('tmp/race-server-test-'));
let server;
try {
  await writeFile(resolve(directory, 'index.html'), '<!doctype html><title>harness policy fixture</title>');
  await writeFile(resolve(directory, 'app-0123456789abcdef.js'), '/* policy test */\n'.repeat(100));
  server = await startStatic(directory);
  await test(async () => {
    const response = await fetch(server.base + '/p/public');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-cache');
    assert.equal(response.headers.get('etag'), null); assert.match(response.headers.get('content-security-policy'), /worker-src 'self' blob:/);
  });
  await test(async () => {
    const response = await fetch(server.base + '/app-0123456789abcdef.js');
    assert.equal(response.headers.get('content-type'), 'application/javascript');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(response.headers.get('content-encoding'), 'gzip'); assert.match(await response.text(), /policy test/);
  });
  await test(async () => {
    const url = server.base + '/app-0123456789abcdef.js';
    const first = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
    const etag = first.headers.get('etag'); await first.arrayBuffer(); assert.match(etag, /^W\//);
    const repeat = await fetch(url, { headers: { 'Accept-Encoding': 'gzip', 'If-None-Match': etag } });
    assert.equal(repeat.status, 304); assert.equal(repeat.headers.get('etag'), etag);
    assert.equal(repeat.headers.get('vary'), 'Accept-Encoding'); assert.equal((await repeat.arrayBuffer()).byteLength, 0);
  });
  await test(async () => assert.equal((await fetch(server.base + '/missing.js')).status, 404));
  await test(async () => assert.equal((await fetch(server.base + '/.hidden')).status, 404));
} finally { await server?.close(); await rm(directory, { recursive: true, force: true }); }
console.log('ok race harness ' + checks + ' checks');
