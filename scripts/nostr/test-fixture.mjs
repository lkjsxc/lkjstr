import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { schnorr } from '@noble/curves/secp256k1.js';
import { WebSocketServer } from 'ws';
import { openState } from '../nostr-enqueue.mjs';
import { eventDigest } from './event.mjs';
import { sourceGit } from './coverage.mjs';
import { initOutbox } from './outbox.mjs';

export function stateFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'lkjstr-nostr-fixture-'));
  const db = openState(directory);
  initOutbox(db);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, db };
}

export function signed(content, revision, now, options = {}) {
  const secret = Buffer.alloc(32, 1);
  const pubkey = Buffer.from(schnorr.getPublicKey(secret)).toString('hex');
  const event = { pubkey, created_at: now, kind: 1, tags: [['r', revision]], content, ...options };
  const digest = eventDigest(event);
  return { ...event, id: digest.toString('hex'), sig: Buffer.from(schnorr.sign(digest, secret)).toString('hex') };
}

export async function loopback(t, message, nips = [50]) {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/nostr+json' });
    response.end(JSON.stringify({ supported_nips: nips }));
  });
  const ws = new WebSocketServer({ server });
  ws.on('connection', socket => {
    socket.on('message', bytes => message(socket, JSON.parse(bytes)));
    socket.on('error', () => {});
  });
  const bound = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await bound;
  t.after(async () => {
    for (const socket of ws.clients) socket.terminate();
    ws.close();
    await new Promise(resolve => server.close(resolve));
  });
  return `ws://127.0.0.1:${server.address().port}/`;
}

export const frame = (socket, ...values) => socket.send(JSON.stringify(values));

const hostId = revision => revision.slice(0, 32);

// A verified deployment receipt shaped like the ship's: `before` is the host release it replaced.
export function releaseFixture(db, revision, verifiedAt, before = 'f'.repeat(32)) {
  const deploy = JSON.stringify({ action: 'deploy', status: 'passed', before, after: hostId(revision) });
  const receipt = { revision, verifiedAt, archive: revision.slice(0, 24).padEnd(64, 'a'), index: 'b'.repeat(64),
    current: hostId(revision), first: hostId(revision), mode: '', host: { first: { deploy } } };
  db.prepare('INSERT INTO releases VALUES (?, ?, ?)').run(revision, verifiedAt, JSON.stringify(receipt));
  db.prepare('INSERT INTO deployments VALUES (?, ?, ?, ?, ?)')
    .run(receipt.current, revision, receipt.archive, verifiedAt, JSON.stringify(receipt));
  return receipt;
}

// A linear source history in a fresh repository; the first commit carries the listed route files.
export function sourceFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'lkjstr-nostr-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  run(['init', '-q', '-b', 'main']);
  run(['config', 'user.name', 'Nostr test']);
  run(['config', 'user.email', 'nostr-test@example.invalid']);
  let count = 0;
  const commit = (subject, path = `change-${++count}.txt`) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), `${subject}\n`);
    run(['add', '.']);
    run(['commit', '-qm', subject]);
    return run(['rev-parse', 'HEAD']);
  };
  for (const path of ['web/src/shared/incoming-link.ts', 'crates/lkjstr-core/src/engine/wire/deep_links.rs']) {
    commit(`route ${path}`, path);
  }
  const listed = commit('listed routes', 'docs/public-deep-links.md');
  return { commit, git: sourceGit(root), listing: { at: listed, event: 'e'.repeat(64) } };
}
