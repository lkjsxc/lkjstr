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

export async function createRealFixture() {
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
  const activePaths = new Map(); // all isolated test contexts share the loopback server
  const mainSockets = new Set(); // tagged browser context that actually owns the two app tabs
  const mainPathsSeen = new Set();
  const socketProbe = { active: false, seen: new Set(), live: new Map(), peak: new Map() };
  ws.on('connection', (socket, req) => {
    if (req.url === '/bunker' || req.url === '/bunker-secret')
      return bunker.route(socket, req.url === '/bunker-secret');
    activePaths.set(socket, req.url);
    if (
      req.headers.cookie?.split(';').some((value) => value.trim() === 'lkjstr_smoke_context=main')
    ) {
      mainSockets.add(socket);
      mainPathsSeen.add(req.url);
      if (socketProbe.active && req.url !== '/reader') {
        socketProbe.seen.add(req.url);
        const live = (socketProbe.live.get(req.url) ?? 0) + 1;
        socketProbe.live.set(req.url, live);
        socketProbe.peak.set(req.url, Math.max(live, socketProbe.peak.get(req.url) ?? 0));
      }
    }
    socket.on('close', () => {
      activePaths.delete(socket);
      if (socketProbe.active && mainSockets.has(socket) && req.url !== '/reader')
        socketProbe.live.set(req.url, Math.max(0, (socketProbe.live.get(req.url) ?? 0) - 1));
      mainSockets.delete(socket);
    });
    const fixtureRelay =
      req.url === '/deep-links' ? deepLinkFake : req.url === '/reader' ? readerFake : fake;
    fixtureRelay.route({
      send: (text) => socket.send(text),
      onMessage: (fn) => socket.on('message', fn),
      onClose: (fn) => socket.on('close', fn),
    });
  });
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
    activePaths,
    mainSockets,
    mainPathsSeen,
    socketProbe,
    relayUrl,
    server,
    close,
  };
}
