// Signed loopback witness for the public note visibility contract.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { chromium } from 'playwright-core';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from './browser-relay.mjs';
import { validateReplies } from './engine-contract.mjs';
import { fixtureProcess } from './engine-fixture-process.mjs';
import { workerBoot } from './engine-harness-boot.mjs';
import { browserTmp } from '../web/scripts/browser-tmp.ts';

process.env.TMPDIR = browserTmp(process.env.TMPDIR ?? resolve('tmp/temp'));
const directory = resolve(process.env.LKJSTR_ENGINE_PKG ?? 'tmp/engine-pkg');
const reportDir = resolve(process.env.LKJSTR_ENGINE_REPORT ?? 'tmp/engine-visibility');
const wasm = await readFile(join(directory, 'lkjstr_engine_bg.wasm'));
const bindings = await readFile(join(directory, 'lkjstr_engine.js'));
const report = { wasmSha256: createHash('sha256').update(wasm).digest('hex'), checks: [], errors: [] };
const check = (label, condition) => {
  report.checks.push({ label, ok: !!condition });
  assert.ok(condition, label);
};
await mkdir(reportDir, { recursive: true });

let outsider;
let profileQueries = 0;
const fake = fakeRelay({ request(_socket, _id, filters) {
  if (filters.some((filter) => filter.kinds?.includes(0) && filter.authors?.includes(outsider))) {
    profileQueries += 1;
  }
  return false;
} });
const server = createServer((request, response) => {
  switch (request.url) {
    case '/lkjstr_engine_bg.wasm': return response.writeHead(200, { 'content-type': 'application/wasm' }).end(wasm);
    case '/lkjstr_engine.js': return response.writeHead(200, { 'content-type': 'text/javascript' }).end(bindings);
    case '/worker.js': return response.writeHead(200, { 'content-type': 'text/javascript' }).end(workerBoot('/strict.js', origin));
    case '/relay': return response.writeHead(200, { 'content-type': 'application/nostr+json' }).end('{}');
    default: return response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html>');
  }
});
await new Promise((ready) => server.listen(0, '127.0.0.1', ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const relay = `${origin.replace('http:', 'ws:')}/relay`;
const sockets = new bundle.wsServer({ server });
sockets.on('connection', (socket, request) => {
  if (request.url !== '/relay') return socket.close();
  fake.route({ send: (message) => socket.send(message),
    onMessage: (handler) => socket.on('message', handler), onClose: (handler) => socket.on('close', handler) });
});
const signer = fixtureProcess('engine-fixtures', { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
const receiveFixture = async () => JSON.parse((await lines.next()).value);
async function fixture(value) {
  signer.stdin.write(`${JSON.stringify(value)}\n`);
  return receiveFixture();
}
const at = Math.floor(Date.now() / 1000);
const sign = (key, kind, offset, content, tags = []) =>
  fixture({ pubkey: key, kind, created_at: at + offset, content, tags });
let browser;
try {
  const { note: reader } = await receiveFixture();
  const friend = (await fixture({ fixtureActor: true })).pubkey;
  outsider = (await fixture({ fixtureActor: true })).pubkey;
  const other = (await fixture({ fixtureActor: true })).pubkey;
  const root = await sign(friend, 1, -50, 'loopback root');
  const offNetwork = await sign(outsider, 1, -49, 'verified note from an author without metadata');
  const word = await sign(friend, 1, -48, 'COVERED_TOKEN https://example.test/private-cover.png');
  const hashtag = await sign(friend, 1, -47, 'tagged text', [['t', 'topic']]);
  const reply = await sign(friend, 1, -46, 'thread covered text', [['e', root.id, '', 'root'], ['e', root.id, '', 'reply']]);
  const cw = await sign(friend, 1, -45, 'ordinary warning body', [['content-warning', 'spoiler']]);
  const deletionTarget = await sign(outsider, 1, -44, 'body before authorized deletion');
  const upcoming = await sign(outsider, 1, -43, 'body before expiry', [['expiration', String(at + 120)]]);
  const expired = await sign(outsider, 1, -42, 'already expired body', [['expiration', String(at - 10)]]);
  const invalid = await sign(outsider, 1, -41, 'FORGED_BODY');
  const original = await sign(friend, 1, -39, 'same delivery text in independent signed notes');
  const repeated = await sign(other, 1, -40, original.content);
  const machine = await sign(other, 1, -38, '{"fixture":"machine payload"}');
  const mutes = await sign(reader.pubkey, 10000, -39, '', [['word', 'covered_token'], ['t', 'TOPIC'], ['e', root.id], ['p', other]]);
  const follows = await sign(reader.pubkey, 3, -38, '', [['p', friend]]);
  const badDelete = await sign(friend, 5, -37, '', [['e', deletionTarget.id]]);
  const trueDelete = await sign(outsider, 5, -36, '', [['e', deletionTarget.id]]);
  for (const event of [root, offNetwork, word, hashtag, reply, cw, deletionTarget, upcoming, expired,
    { ...invalid, sig: '0'.repeat(128) }, original, repeated, machine, mutes, follows, badDelete]) fake.add(event);

  const cache = `${process.env.HOME}/.cache/ms-playwright`;
  const executables = (await readdir(cache).catch(() => [])).filter((folder) => /^chromium-\d+$/.test(folder));
  const latest = executables.sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1])).at(-1);
  const executablePath = process.env.LKJSTR_CHROME ?? (latest ? join(cache, latest, 'chrome-linux64/chrome') : undefined);
  browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.route('**/*', (route) => new URL(route.request().url()).origin === origin
    ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  await page.goto(origin);
  await page.evaluate(() => {
    window.worker = new Worker('/worker.js', { type: 'module' });
    window.rows = {};
    window.messages = [];
    window.worker.onmessage = ({ data }) => {
      window.messages.push(data);
      if (data.t === 'rows') window.rows[data.sub] = data.rows;
      if (data.t !== 'patch') return;
      const current = window.rows[data.sub] ??= [];
      for (const op of data.ops) {
        if (op.op === 'insert') current.splice(op.before === null ? current.length : current.findIndex((r) => r.key === op.before), 0, ...op.rows);
        if (op.op === 'remove') current.splice(current.findIndex((r) => r.key === op.key), 1);
        if (op.op === 'update') current[current.findIndex((r) => r.key === op.row.key)] = op.row;
      }
    };
  });
  const send = (message) => page.evaluate((value) => window.worker.postMessage(value), message);
  const wait = (predicate, value) => page.waitForFunction(predicate, value, { timeout: 15000 });
  const ready = (type, sub) => wait(({ type, sub }) => window.messages.some((m) => m.t === type && m.sub === sub), { type, sub });
  const open = (sub, query) => send({ t: 'open', sub, query });
  const row = async (sub, id, reason) => (await wait(({ sub, id, reason }) => window.rows[sub]?.find((candidate) =>
    candidate.id === id && (reason === undefined || candidate.hidden?.reason === reason)), { sub, id, reason })).jsonValue();
  const act = async (req, sub, id, reveal) => {
    await send({ t: 'act', req, action: { a: 'note.reveal', sub, key: id, reveal } });
    return (await wait((req) => window.messages.find((m) => m.t === 'result' && m.req === req), req)).jsonValue();
  };
  await ready('ready');
  await send({ t: 'configure', config: { language: 'en', signedOutGlobalFilter: true } });
  await send({ t: 'relays', relays: [{ url: relay, read: true, write: false, search: false }] });
  await open('visitor', { source: 'global' });
  await ready('rows', 'visitor');
  const metadataUntil = Date.now() + 10000;
  while (!profileQueries && Date.now() < metadataUntil) await new Promise((done) => setTimeout(done, 50));
  check('visitor profile request completed without a profile fixture', profileQueries > 0);
  await page.waitForTimeout(350);
  check('ordinary off-network note survives completed metadata lookup',
    await page.evaluate(({ id, author }) => window.rows.visitor.some((r) => r.id === id && !r.hidden && r.author.pubkey === author),
      { id: offNetwork.id, author: outsider }));
  check('visitor author cap keeps a verified covered slot', !(await row('visitor', root.id, 'author-limit')).segments.length);
  check('signed repeated content has its own reason', (await row('visitor', repeated.id, 'repeated-content')).hidden.revealable);
  check('machine payload stays body-free', !(await row('visitor', machine.id, 'machine-payload')).segments.length);

  await open('home', { source: 'home', account: reader.pubkey, replies: false });
  const covered = await row('home', word.id, 'muted-word');
  check('word mute keeps a single safe slot with its matching entry', covered.key === word.id && covered.hidden.detail === 'covered_token' &&
    !covered.segments.length && !covered.media.length && !covered.quotes.length && !JSON.stringify(covered).includes('https://example.test'));
  await open('signed-global', { source: 'global', account: reader.pubkey });
  check('person mute takes precedence over machine payload', (await row('signed-global', machine.id, 'muted-person')).hidden.revealable);
  check('hashtag mute identifies its own entry', (await row('home', hashtag.id, 'muted-hashtag')).hidden.detail === 'TOPIC');
  check('ordinary Home retains follows-only membership and explicit reply selection',
    await page.evaluate((ids) => window.rows.home.every((r) => !ids.includes(r.id)), [offNetwork.id, reply.id]));
  const warning = await row('home', cw.id);
  check('NIP-36 keeps normal note fields', warning.cw === 'spoiler' && !warning.hidden && warning.segments.length > 0);

  await open('profile', { source: 'profile', account: reader.pubkey, pubkey: friend, show: 'replies' });
  check('profile replies keep covered rows', (await row('profile', reply.id, 'muted-thread')).hidden.revealable);
  await open('thread', { source: 'thread', account: reader.pubkey, id: root.id });
  check('thread reply retains its verified parent and depth', (await row('thread', reply.id, 'muted-thread')).thread.parent === root.id);
  check('unknown subscription cannot reveal', !(await act('wrong', 'absent', word.id, true)).ok);
  check('verified word reveal succeeds', (await act('show', 'home', word.id, true)).ok);
  check('show is scoped and keeps the original key', await page.evaluate((id) => window.rows.home.some((r) => r.key === id && r.revealed?.reason === 'muted-word' && r.segments.length), word.id));
  check('repeated show is idempotent', (await act('show-again', 'home', word.id, true)).ok);
  check('hide again is acknowledged', (await act('cover', 'home', word.id, false)).ok);
  check('re-cover redacts the body again', !(await row('home', word.id, 'muted-word')).segments.length);

  const invalidState = await wait(() => window.messages.find((message) => message.sub === 'visitor' && message.state?.unshown?.some((item) => item.reason === 'invalid')));
  check('invalid delivery produces scoped evidence without a row or identity', (await invalidState.jsonValue()).state.unshown.some((item) =>
    item.reason === 'invalid' && item.count > 0) && await page.evaluate((ids) => window.rows.visitor.every((r) => !ids.includes(r.id)), [invalid.id, expired.id]));
  const deleteBefore = await row('visitor', deletionTarget.id);
  check('wrong-author deletion leaves a verified note', deleteBefore.segments.length > 0);
  const beforeExpiry = await row('visitor', upcoming.id);
  check('expiry timestamp is projected while note is live', beforeExpiry.expiresAt === (at + 120) * 1000);
  fake.add(trueDelete);
  const deleted = await row('visitor', deletionTarget.id, 'deleted');
  check('authorized deletion replaces the slot and removes its body', deleted.key === deleteBefore.key && !deleted.segments.length && !deleted.hidden.revealable);
  check('deleted note cannot be revealed', !(await act('deleted', 'visitor', deletionTarget.id, true)).ok);
  await send({ t: 'test.advance', ms: 130000 });
  const dead = await row('visitor', upcoming.id, 'expired');
  check('validated expiry replaces its observed slot', dead.key === upcoming.id && !dead.hidden.revealable && !dead.segments.length);
  check('expired note cannot be revealed', !(await act('expired', 'visitor', upcoming.id, true)).ok);
  validateReplies(await page.evaluate(() => window.messages));
  check('fixture ran read-only with no browser errors', !report.errors.length && !fake.published.length);
  console.log(`ok engine-note-visibility (${report.checks.length} checks)`);
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  await browser?.close();
  for (const socket of sockets.clients) socket.terminate();
  sockets.close();
  await new Promise((done) => server.close(done));
  signer.stdin.end();
  signer.kill();
  await writeFile(join(reportDir, 'report.json'), JSON.stringify(report, null, 2));
}
