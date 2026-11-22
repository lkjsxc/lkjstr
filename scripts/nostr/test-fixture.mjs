import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { schnorr } from '@noble/curves/secp256k1.js';
import { WebSocketServer } from 'ws';
import { openState } from '../nostr-enqueue.mjs';
import { eventDigest } from './event.mjs';
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

export function releaseFixture(db, revision, verifiedAt) {
  db.prepare('INSERT INTO releases VALUES (?, ?, ?)').run(revision, verifiedAt,
    JSON.stringify({ revision, verifiedAt, archive: 'a'.repeat(64), index: 'b'.repeat(64) }));
}
