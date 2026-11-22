import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { recordSocketWindow } from './smoke-real-finish.mjs';
import { attachSmokeRelay } from './smoke-real-fixture.mjs';
import { createSocketTrace } from './smoke-socket-trace.mjs';

const NEEDLE = 'sharing-probe-test';
const req = (id, search) => JSON.stringify(['REQ', id, { kinds: [1] }, { search }]);
const handshake = (url, key) => ({
  url,
  headers: { host: '127.0.0.1:1', 'sec-websocket-key': key },
});

function replay(late = false, closeOld = true) {
  let time = 456650.530503;
  const trace = createSocketTrace(() => time);
  const oldSocket = {};
  const newSocket = {};
  trace.open(oldSocket, handshake('/owner', 'old'));
  time = 456705.970068;
  trace.activate([oldSocket]);
  time = 456706.040109;
  trace.secondTab();
  trace.setNeedle(NEEDLE);
  time = 456842.188071;
  trace.open(newSocket, handshake('/owner', 'new'));
  trace.frame(newSocket, req('w9', NEEDLE));
  if (late) trace.frame(oldSocket, req('delivery-9'));
  if (closeOld) {
    time = 456872.648624;
    trace.close(oldSocket);
  }
  time = 459941.834286;
  trace.startSettling();
  trace.seal(closeOld ? [newSocket] : [oldSocket, newSocket], true);
  return trace.judge();
}

test('retained handover timing permits the old peak of two', () => {
  // #3381 supplied socket lifetimes. The test adds a synthetic needle frame.
  const receipt = replay();
  assert.equal(receipt.ok, true);
  const [owner] = receipt.paths;
  assert.equal(owner.path, '/owner');
  assert.equal(owner.peak, 2);
  assert.equal(owner.live, 1);
  assert.equal(owner.overlapPairs, 1);
  assert.ok(Math.abs(owner.maxOverlapMs - 30.460553) < 0.000001);
  assert.deepEqual(owner.receiveInterleave, []);
  assert.deepEqual(receipt.needleSockets, [2]);
});

test('late old-socket delivery is diagnostic after settling', () => {
  const receipt = replay(true);
  assert.equal(receipt.ok, true);
  const [owner] = receipt.paths;
  assert.equal(owner.peak, 2);
  assert.deepEqual(owner.receiveInterleave, [{ older: 1, newer: 2 }]);
  assert.deepEqual(receipt.duplicateWires, [
    { path: '/owner', pathId: '/owner', number: 9, first: 2, next: 1 },
  ]);
});

test('a duplicate still live at seal refuses', () => {
  const receipt = replay(false, false);
  assert.deepEqual(receipt.reasons, ['settled-duplicate']);
  assert.equal(receipt.paths[0].peak, 2);
  assert.equal(receipt.paths[0].live, 2);
  assert.deepEqual(receipt.paths[0].receiveInterleave, []);
  assert.deepEqual(receipt.needleSockets, [2]);
});

function begin() {
  const trace = createSocketTrace();
  const socket = {};
  trace.open(socket, handshake('/', 'first'));
  trace.activate([socket]);
  trace.secondTab();
  trace.setNeedle(NEEDLE);
  trace.frame(socket, req('w100', NEEDLE));
  trace.startSettling();
  return { trace, socket };
}

test('coverage refuses socket churn past the bound even with a needle and settled sockets', () => {
  const { trace, socket } = begin();
  for (let n = 0; n < 64; n++) {
    const extra = {};
    trace.open(extra, handshake('/owner', 'extra'));
    trace.close(extra);
  }
  trace.seal([socket], true);
  const receipt = trace.judge();
  assert.equal(receipt.sockets.length, 64);
  assert.equal(receipt.droppedSockets, 1);
  assert.deepEqual(receipt.reasons, ['socket-limit']);
});

test('coverage refuses a malformed frame and catches a missing lifecycle update', () => {
  const { trace } = begin();
  const extra = {};
  trace.open(extra, handshake('/owner', 'extra'));
  trace.frame(extra, 'malformed');
  trace.seal([extra], true);
  const receipt = trace.judge();
  assert.deepEqual(receipt.reasons, ['frame-parse', 'socket-lifecycle']);
  assert.equal(receipt.unparsedFrames, 1);
});

test('coverage refuses overflow of distinct numeric wire IDs', () => {
  const { trace, socket } = begin();
  for (let n = 101; n <= 4196; n++) trace.frame(socket, req(`w${n}`));
  trace.seal([socket], true);
  const receipt = trace.judge();
  assert.deepEqual(receipt.reasons, ['wire-id-limit']);
  assert.equal(receipt.sockets[0].wire.count, 4097);
});

test('wire regression and an arbitrary valid subscription ID are diagnostics', () => {
  const { trace, socket } = begin();
  trace.close(socket);
  const successor = {};
  trace.open(successor, handshake('/', 'successor'));
  trace.frame(successor, req('w1'));
  trace.frame(successor, req('arbitrary'));
  trace.close(successor);
  trace.seal([], true);
  const receipt = trace.judge();
  assert.equal(receipt.ok, true);
  assert.equal(receipt.paths[0].live, 0);
  assert.equal(receipt.paths[0].succession, 'regressed');
  assert.equal(receipt.sockets[1].wire.unparsed, 1);
});

test('canonical loopback hook records receipts on pass and refusal', {
  timeout: 5000,
}, async (t) => {
  const temporary = fileURLToPath(new URL('../../tmp/', import.meta.url));
  await mkdir(temporary, { recursive: true });
  const out = await mkdtemp(join(temporary, 'socket-trace-'));
  const previous = process.env.LKJSTR_SMOKE_OUTPUT;
  t.after(async () => {
    if (previous === undefined) delete process.env.LKJSTR_SMOKE_OUTPUT;
    else process.env.LKJSTR_SMOKE_OUTPUT = previous;
    await rm(out, { recursive: true, force: true });
  });
  const cases = [
    { name: 'handover closes while settling', closeDuringSettle: true, reasons: [] },
    { name: 'late old-socket receive', late: true, reasons: [] },
    { name: 'persistent duplicate', duplicate: true, reasons: ['settled-duplicate'] },
    { name: 'needle outside scope', foreign: true, reasons: ['main-needle-missing'] },
    { name: 'malformed recorder input', malformed: true, reasons: ['frame-parse'] },
    { name: 'unexpected learned route', extraPath: true, reasons: [] },
    { name: 'unexpected learned route opens during settling', lateExtraPath: true, reasons: [] },
    { name: 'refused probe', abort: true, reasons: ['window-incomplete'] },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async (t) => {
      const output = await mkdtemp(join(out, 'attempt-'));
      process.env.LKJSTR_SMOKE_OUTPUT = output;
      const server = createServer();
      const ws = new bundle.wsServer({ server });
      const fake = fakeRelay();
      const readerFake = fakeRelay();
      const sharing = attachSmokeRelay(ws, { fake, readerFake, deepLinkFake: fake });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const clients = [];
      t.after(async () => {
        for (const client of clients) client.terminate();
        await new Promise((done) => ws.close(done));
        await new Promise((done) => server.close(done));
      });

      async function connect(path, main = true) {
        const accepted = once(ws, 'connection');
        const cookie = main ? 'unrelated=yes; lkjstr_smoke_context=main' : 'unrelated=yes';
        const client = new bundle.ws(`ws://127.0.0.1:${server.address().port}${path}`, {
          headers: { Cookie: cookie },
        });
        clients.push(client);
        const [[peer]] = await Promise.all([accepted, once(client, 'open')]);
        return { client, peer };
      }

      async function send({ client }, id, search) {
        const response = once(client, 'message');
        client.send(req(id, search));
        const [raw] = await response;
        assert.deepEqual(JSON.parse(String(raw)), ['EOSE', id]);
      }

      const older = await connect('/owner');
      await send(older, 'w1', 'preactivation-search');
      let lateRoute;
      const run = recordSocketWindow(
        sharing,
        async () => {
          sharing.trace.secondTab();
          sharing.trace.setNeedle(NEEDLE);
          const newer = await connect('/owner');
          if (scenario.foreign) {
            await send(await connect('/', false), 'w5', NEEDLE);
            await send(await connect('/reader'), 'w6', NEEDLE);
            assert.ok(fake.searches.includes(NEEDLE));
            assert.ok(readerFake.searches.includes(NEEDLE));
          } else {
            await send(newer, 'w9', NEEDLE);
          }
          if (scenario.late) await send(older, 'w8');
          if (scenario.malformed) await send(newer, 10);
          if (scenario.extraPath) await send(await connect('/unexpected?test=private'), 'w11');
          if (scenario.lateExtraPath) {
            assert.equal(sharing.learnedRelays(), true);
            lateRoute = new Promise((resolve) => setImmediate(resolve)).then(async () => {
              await send(await connect('/unexpected?test=private'), 'w11');
              older.client.close();
            });
            // Keep a fixture failure available for the explicit await below.
            lateRoute.catch(() => {});
          } else if (scenario.closeDuringSettle) setImmediate(() => older.client.close());
          else if (!scenario.duplicate && !scenario.abort) {
            const closed = once(older.peer, 'close');
            older.client.close();
            await closed;
          }
          if (scenario.abort) throw new Error('visibility check refused');
          return newer;
        },
        scenario.closeDuringSettle || scenario.lateExtraPath ? 10 : 1,
      );
      const result = scenario.abort
        ? await assert.rejects(run, /visibility check refused/)
        : await run;
      await lateRoute;
      const receipt = JSON.parse(await readFile(join(output, 'smoke-real-sockets.json'), 'utf8'));
      if (result) assert.deepEqual(receipt, result.receipt);
      assert.equal(receipt.ok, scenario.reasons.length === 0);
      assert.deepEqual(receipt.reasons, scenario.reasons);
      const hasExtraPath = scenario.extraPath || scenario.lateExtraPath;
      assert.equal(receipt.sockets.length, hasExtraPath ? 3 : 2);
      const [owner] = receipt.paths;
      assert.equal(owner.path, '/owner');
      assert.equal(owner.peak, 2);
      assert.equal(owner.receiveInterleave.length, scenario.late ? 1 : 0);
      assert.deepEqual(receipt.needleSockets, scenario.foreign ? [] : [2]);
      assert.equal(sharing.mainPathsSeen.has('/owner'), true);
      assert.equal(receipt.learnedRelays, !hasExtraPath);
      if (scenario.closeDuringSettle || scenario.lateExtraPath) assert.ok(receipt.settleWaitMs > 0);
      if (hasExtraPath) {
        assert.equal(receipt.paths[1].path, '<other>');
        assert.doesNotMatch(JSON.stringify(receipt), /test=private/);
      }
      assert.match(receipt.sockets[0].keyHash, /^[0-9a-f]{16}$/);
      assert.equal(receipt.sockets[0].framesBeforeActivation, 1);
      assert.equal(receipt.sockets[0].frames.REQ, scenario.late ? 1 : 0);
    });
  }
});
