// Exact selected-mention publication and separate relay readback through the Worker.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { fixtureProcess } from './engine-fixture-process.mjs';
import { workerBoot } from './engine-harness-boot.mjs';
import { bech32 } from '../web/scripts/smoke-visitors.mjs';

const pkg = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const out = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/engine-mentions');
const wasm = await readFile(join(pkg, 'lkjstr_engine_bg.wasm'));
const bindings = await readFile(join(pkg, 'lkjstr_engine.js'));
const report = {
  wasmSha256: createHash('sha256').update(wasm).digest('hex'),
  cases: [],
  errors: [],
};
await mkdir(out, { recursive: true });

const fake = fakeRelay();
const acknowledgements = new Map();
const server = createServer((req, res) => {
  if (req.url === '/lkjstr_engine_bg.wasm') {
    return res.writeHead(200, { 'content-type': 'application/wasm' }).end(wasm);
  }
  if (req.url === '/lkjstr_engine.js') {
    return res.writeHead(200, { 'content-type': 'text/javascript' }).end(bindings);
  }
  if (req.url === '/worker.js') {
    return res.writeHead(200, { 'content-type': 'text/javascript' })
      .end(workerBoot('/archive-worker.js', origin));
  }
  if (req.url === '/relay') {
    return res.writeHead(200, { 'content-type': 'application/nostr+json' }).end('{}');
  }
  return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html>');
});
await new Promise((done, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', done);
});
const origin = `http://127.0.0.1:${server.address().port}`;
const relay = `${origin.replace('http:', 'ws:')}/relay`;
const sockets = new bundle.wsServer({ server });
sockets.on('connection', (socket, req) => {
  if (req.url !== '/relay') return socket.close();
  fake.route({
    send(text) {
      const message = JSON.parse(text);
      if (message[0] === 'OK') acknowledgements.set(message[1], message);
      socket.send(text);
    },
    onMessage: (fn) => socket.on('message', fn),
    onClose: (fn) => socket.on('close', fn),
  });
});

async function start(browser) {
  const context = await browser.newContext();
  await context.route('**/*', (r) => new URL(r.request().url()).origin === origin
    ? r.continue() : r.abort());
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(String(error)));
  await page.goto(origin);
  await page.evaluate(() => {
    window.messages = [];
    window.worker = new Worker('/worker.js', { type: 'module' });
    window.worker.onmessage = (event) => window.messages.push(event.data);
  });
  const send = (message) => page.evaluate((m) => window.worker.postMessage(m), message);
  const receive = async (type, req) => {
    const handle = await page.waitForFunction(({ type, req }) =>
      window.messages.find((m) => m.t === type && (req === undefined || m.req === req)),
    { type, req }, { timeout: 15000 });
    return handle.jsonValue();
  };
  await receive('ready');
  await send({ t: 'configure', config: { language: 'en', linkPreviews: false } });
  await send({ t: 'relays', relays: [{ url: relay, read: true, write: true, search: false }] });
  const read = async (id) => {
    await send({ t: 'open', sub: id, query: { source: 'thread', id } });
    await send({ t: 'window', sub: id, anchor: 'top', before: 0, after: 6 });
    const row = await page.waitForFunction((id) => window.messages
      .filter((message) => message.sub === id)
      .flatMap((message) => message.rows ?? message.ops?.flatMap((op) =>
        op.rows ?? (op.row ? [op.row] : [])) ?? [])
      .find((row) => row.id === id), id, { timeout: 15000 });
    await send({ t: 'close', sub: id });
    return row.jsonValue();
  };
  const people = async (sub, account, id, expected) => {
    await send({ t: 'open', sub, query: { source: 'people', text: '', account, id } });
    await send({ t: 'window', sub, anchor: 'top', before: 0, after: 6 });
    const found = await page.waitForFunction(({ sub, expected }) => window.messages
      .filter((message) => message.sub === sub && message.t === 'rows')
      .find((message) => message.rows.length === expected.length &&
        message.rows.every((row, index) => row.author.pubkey === expected[index] &&
          row.author.profileId)), { sub, expected }, { timeout: 15000 });
    await send({ t: 'close', sub });
    return (await found.jsonValue()).rows.map(({ author }) => author);
  };
  return { send, receive, read, people };
}

function draftFor(route, recipient, target) {
  const references = [recipient, recipient];
  if (route !== 'Post') references.push(target.pubkey);
  let text = '🌿';
  let expected = text;
  const mentions = references.map((pubkey) => {
    const label = pubkey === recipient ? '@Recipient' : '@Target';
    const start = text.length + 1;
    text += ` ${label}`;
    expected += ` nostr:${bech32('npub', pubkey)}`;
    return { start, end: text.length, label, pubkey };
  });
  text += ' @Ignored';
  expected += ' @Ignored';
  const draft = { text, mentions };
  if (route === 'inline Reply') draft.replyTo = target.id;
  if (route === 'Quote') {
    draft.quote = target.id;
    expected += `\nnostr:${bech32('note', target.id)}`;
  }
  return { draft, expected, references };
}

const signer = fixtureProcess('engine-fixtures', { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
const next = async () => JSON.parse((await lines.next()).value);
const sign = (request) => {
  signer.stdin.write(`${JSON.stringify(request)}\n`);
  return next();
};
let browser;
try {
  const [{ note }, targetActor, recipient] = [
    await next(),
    await sign({ fixtureActor: true }),
    await sign({ fixtureActor: true }),
  ];
  const root = await sign({ pubkey: note.pubkey, kind: 1, created_at: 1700000000,
    content: 'mention thread root', tags: [] });
  const target = await sign({ pubkey: targetActor.pubkey, kind: 1, created_at: 1700000001,
    content: 'mention reply and quote target', tags: [['e', root.id, '', 'root'], ['p', note.pubkey]] });
  const follows = await sign({ pubkey: note.pubkey, kind: 3, created_at: 1700000000,
    content: '', tags: [['p', recipient.pubkey], ['p', note.pubkey]] });
  for (const event of [root, target, targetActor, recipient, follows]) fake.add(event);
  const cache = `${process.env.HOME}/.cache/ms-playwright`;
  const executablePath = process.env.LKJSTR_CHROME ??
    join(cache, (await readdir(cache)).filter((name) => name.startsWith('chromium-'))
      .sort().at(-1), 'chrome-linux64/chrome');
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const writer = await start(browser);
  await writer.send({ t: 'act', req: 'account', action: { a: 'account.add', how: 'extension' } });
  await writer.receive('getPublicKey', 'account');
  await writer.send({ t: 'publicKey', req: 'account', pubkey: note.pubkey });
  assert.equal((await writer.receive('result', 'account')).ok, true);
  await writer.read(target.id);
  report.people = {
    post: await writer.people('post-people', note.pubkey, undefined, [recipient.pubkey]),
    contextual: await writer.people('contextual-people', note.pubkey, target.id,
      [target.pubkey, recipient.pubkey]),
  };
  console.log('ok bare mention follows and context load their profiles');

  for (const route of ['Post', 'inline Reply', 'Quote']) {
    const { draft, expected, references } = draftFor(route, recipient.pubkey, target);
    await writer.send({ t: 'act', req: route, action: {
      a: 'publish', as: note.pubkey, what: { k: 'note', draft },
    } });
    const request = await writer.receive('sign', route);
    const signed = await sign(JSON.parse(request.event));
    await writer.send({ t: 'signed', req: route, event: JSON.stringify(signed) });
    const result = await writer.receive('result', route);
    const received = fake.published.find((event) => event.id === signed.id);
    const ack = acknowledgements.get(signed.id);
    const evidence = { route, signed, received, ack, result, references };
    report.cases.push(evidence);
    assert.deepEqual(received, signed);
    assert.deepEqual(ack, ['OK', signed.id, true, '']);
    assert.equal(result.id, signed.id);
    assert.equal(result.ok, true);
    assert.deepEqual(result.delivery.map(({ url, state }) => [url, state]), [[relay, 'ok']]);
    assert.equal(signed.content, expected);
    assert.equal(signed.kind, 1);
    const tags = (key) => signed.tags.filter((tag) => tag[0] === key);
    const keys = route === 'Post' ? [recipient.pubkey]
      : route === 'Quote' ? [target.pubkey, recipient.pubkey]
        : [target.pubkey, note.pubkey, recipient.pubkey];
    assert.deepEqual(tags('p'), keys.map((key) => ['p', key]));
    assert.deepEqual(tags('e'), route === 'inline Reply'
      ? [['e', root.id, '', 'root'], ['e', target.id, '', 'reply']] : []);
    assert.deepEqual(tags('q'), route === 'Quote' ? [['q', target.id]] : []);
  }
  const reader = await start(browser);
  for (const evidence of report.cases) {
    const row = await reader.read(evidence.signed.id);
    evidence.inbound = row.segments.filter((segment) => segment.k === 'mention');
    assert.deepEqual(evidence.inbound.map((segment) => segment.pubkey), evidence.references);
    console.log(`ok mention ${evidence.route}: ${evidence.signed.id}`);
  }
  assert.deepEqual(report.errors, []);
} finally {
  signer.stdin.end();
  await browser?.close();
  sockets.close();
  await new Promise((done) => server.close(done));
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 2));
}
