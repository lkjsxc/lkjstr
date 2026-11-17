import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import bundle from 'playwright-core/lib/utilsBundle';
import { privatePolicy, privateFixture } from './cache-repeat-private-fixture.mjs';
import { installPrivateCacheProbe } from './cache-repeat-private-probe.mjs';
import { domProbe } from './cache-repeat-dom-fixture.mjs';
test('private fixture policy permits only its owned loopback relay and local assets', () => {
  const csp = privatePolicy('ws://127.0.0.1:12345/relay');
  assert.match(csp, /connect-src 'self' ws:\/\/127\.0\.0\.1:12345\/relay;/);
  assert.doesNotMatch(csp, /(?:connect|img|media|font)-src[^;]*(?:https:|wss:)/);
  for (const bad of ['wss://public.example', 'ws://localhost:12345/relay', 'ws://127.0.0.1:12345/other'])
    assert.throws(() => privatePolicy(bad), /Owned loopback/);
});
async function source(t) {
  const directory = await mkdtemp(new URL('../tmp/private-cache-test-', import.meta.url));
  const html = '<!doctype html><title>Private fixture</title>' + 'body'.repeat(100);
  await writeFile(directory + '/index.html', html);
  const fixture = await privateFixture(directory);
  t.after(async () => { await fixture.close(); await rm(directory, { recursive: true, force: true }); });
  return { fixture, html };
}
test('loopback proxy preserves build bytes and cannot forward an escaped path to another origin', async t => {
  const { fixture, html } = await source(t);
  const response = await fetch(fixture.base);
  assert.equal(await response.text(), html); assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.equal(response.headers.get('content-security-policy'), fixture.csp);
  let reached = 0;
  const other = createServer((_, response) => { reached++; response.end('unrelated'); });
  other.listen(0, '127.0.0.1'); await once(other, 'listening');
  t.after(() => new Promise(done => other.close(done)));
  const status = await new Promise((done, reject) => {
    const outgoing = request(fixture.base, { path: '/\\\\127.0.0.1:' + other.address().port + '/' }, response => {
      response.resume(); response.on('end', () => done(response.statusCode));
    });
    outgoing.on('error', reject); outgoing.end();
  });
  assert.equal(status, 404); assert.equal(reached, 0);
});
async function ask(socket, sub) {
  return new Promise((resolve, reject) => {
    const rows = [], timer = setTimeout(() => { socket.off('message', receive); reject(Error('Fixture reply timeout')); }, 2000);
    const receive = raw => {
      const value = JSON.parse(String(raw)); if (value[1] !== sub) return;
      rows.push(value[0]);
      if (value[0] === 'EOSE') { clearTimeout(timer); socket.off('message', receive); resolve(rows); }
    };
    socket.on('message', receive); socket.send(JSON.stringify(['REQ', sub, { kinds: [1059] }]));
  });
}
test('the owned relay can withhold replay without fabricating traffic or retaining bodies in counters', async t => {
  const { fixture } = await source(t);
  fixture.fake.add({ id: 'a'.repeat(64), pubkey: 'b'.repeat(64), kind: 1059,
    created_at: 1, tags: [], content: 'synthetic envelope payload' });
  const socket = new bundle.ws(fixture.relayUrl); await once(socket, 'open');
  t.after(() => socket.terminate());
  assert.deepEqual(await ask(socket, 'first'), ['EVENT', 'EOSE']);
  const before = fixture.snapshot(); fixture.silence();
  assert.deepEqual(await ask(socket, 'held'), ['EOSE']);
  const after = fixture.snapshot(); assert.equal(after.events - before.events, 0);
  assert.ok(after.clientReceivedBytes > before.clientReceivedBytes);
  assert.equal(JSON.stringify(after).includes('synthetic envelope payload'), false);
});
test('private body proof requires a subsequent visible frame and exposes only readiness metadata', async () => {
  const dom = await domProbe({ kind: 'message' });
  try {
    dom.window.eval('(' + installPrivateCacheProbe.toString() + ')()');
    const row = dom.add('message'); row.row.className = 'dm-row'; row.row.textContent = 'owned private marker';
    dom.window.__privateCacheProbe.begin('message', 'owned private marker', 1000000);
    await dom.advance(16); assert.equal(dom.window.__privateCacheProbe.result().paintedMs, undefined);
    await dom.advance(32); const result = dom.window.__privateCacheProbe.result();
    assert.equal(result.paintedMs, 32); assert.equal(result.bodyPresent, true);
    assert.equal(JSON.stringify(result).includes('owned private marker'), false);
    row.row.dataset.y = '1200'; assert.equal(dom.window.__privateCacheProbe.result().bodyPresent, false);
    row.row.dataset.y = '0'; row.row.hidden = true; assert.equal(dom.window.__privateCacheProbe.result().bodyPresent, false);
    dom.window.__privateCacheProbe.clear();
  } finally { dom.close(); }
});
