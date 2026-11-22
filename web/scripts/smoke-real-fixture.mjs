// Loopback services and signed fixtures for the real browser smoke.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import bundle from 'playwright-core/lib/utilsBundle';
import { fakeBunker } from '../../scripts/browser-bunker.mjs';
import { fakeMediaSet } from '../../scripts/browser-media.mjs';
import { fakeRelay } from '../../scripts/browser-relay.mjs';
import { browserTmp } from './browser-tmp.ts';
import { createSocketTrace } from './smoke-socket-trace.mjs';

export async function createRealFixture() {
  const dist = process.env.LKJSTR_SMOKE_DIST;
  if (!dist) throw new Error('LKJSTR_SMOKE_DIST must name the files to serve');
  const root = new URL('../../', import.meta.url).pathname;
  process.chdir(root);
  process.env.TMPDIR = browserTmp(process.env.TMPDIR ?? `${root}tmp/temp`);
  process.env.XDG_CACHE_HOME ??= `${root}tmp/cache`;
  process.env.XDG_CONFIG_HOME ??= `${root}tmp/config`;
  process.env.XDG_DATA_HOME ??= `${root}tmp/data`;
  await mkdir(process.env.TMPDIR, { recursive: true });
  const signer = spawn(
    'cargo',
    ['run', '-q', '-p', 'lkjstr-core', '--example', 'engine-fixtures'],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );
  signer.stderr.resume();
  const lines = createInterface({ input: signer.stdout })[Symbol.asyncIterator]();
  const fixture = JSON.parse((await lines.next()).value);
  // Combined wishes, archive and owner-audit data retain at most 2000 loopback events.
  const fake = fakeRelay({ maxEvents: 2000 });
  // The archive/audit can fill one 1000-event store; reader arrivals get their own bounded fixture.
  const readerFake = fakeRelay();
  const deepLinkFake = fakeRelay();
  const bunker = await fakeBunker();
  const media = await fakeMediaSet();
  for (const event of [fixture.note, ...fixture.events]) {
    fake.add(event);
    readerFake.add(event);
    deepLinkFake.add(event);
  }
  let signing = Promise.resolve();
  const relay = createServer();
  const ws = new bundle.wsServer({ server: relay });
  const socketSharing = attachSmokeRelay(ws, { fake, readerFake, deepLinkFake, bunker });
  await new Promise((done) => relay.listen(0, '127.0.0.1', done));
  const relayUrl = `ws://127.0.0.1:${relay.address().port}`;
  signer.stdin.write(
    `${JSON.stringify({ pubkey: fixture.note.pubkey, created_at: Math.floor(Date.now() / 1000), kind: 10002, tags: [['r', `${relayUrl}/owner`]], content: '' })}\n`,
  );
  fake.add(JSON.parse((await lines.next()).value));
  const server = spawn(
    process.execPath,
    [
      'web/scripts/serve.ts',
      `--dist=${dist}`,
      '--port=0',
      '--test-previews',
      `--test-relay=${relayUrl}`,
      `--test-media=${Object.values(media.origins).join(',')}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const fixtureSign = (event) => {
    const task = signing.then(async () => {
      signer.stdin.write(`${JSON.stringify(event)}\n`);
      return JSON.parse((await lines.next()).value);
    });
    signing = task.then(() => undefined);
    return task;
  };
  const close = async () => {
    server.kill();
    signer.stdin.end();
    await bunker.close();
    await media.close();
    ws.close();
    await new Promise((done) => relay.close(done));
  };
  return {
    fixture,
    fixtureSign,
    fake,
    readerFake,
    deepLinkFake,
    bunker,
    media,
    socketSharing,
    relayUrl,
    server,
    close,
  };
}

export function attachSmokeRelay(ws, { fake, readerFake, deepLinkFake, bunker }) {
  const trace = createSocketTrace();
  const activePaths = new Map(); // all isolated test contexts share the loopback server
  const mainSockets = new Set(); // tagged context, excluding readers and signer routes
  const mainPathsSeen = new Set();
  ws.on('connection', (socket, req) => {
    if (req.url === '/bunker' || req.url === '/bunker-secret')
      return bunker.route(socket, req.url === '/bunker-secret');
    activePaths.set(socket, req.url);
    const main = req.headers.cookie
      ?.split(';')
      .some((value) => value.trim() === 'lkjstr_smoke_context=main');
    const inTrace = main && req.url !== '/reader';
    if (main) mainPathsSeen.add(req.url);
    if (inTrace) {
      mainSockets.add(socket);
      trace.open(socket, req);
      socket.on('message', (raw, binary) => trace.frame(socket, raw, binary));
    }
    socket.on('close', () => {
      activePaths.delete(socket);
      if (inTrace) {
        mainSockets.delete(socket);
        trace.close(socket);
      }
    });
    const fixtureRelay =
      req.url === '/deep-links' ? deepLinkFake : req.url === '/reader' ? readerFake : fake;
    fixtureRelay.route({
      send: (text) => socket.send(text),
      onMessage: (fn) => socket.on('message', fn),
      onClose: (fn) => socket.on('close', fn),
    });
  });
  return {
    activePaths,
    mainPathsSeen,
    trace,
    liveMainSockets: () => [...mainSockets],
    learnedRelays: () => mainPathsSeen.has('/owner') && !trace.unexpectedPath(),
  };
}
