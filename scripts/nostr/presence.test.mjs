import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { openState } from '../nostr-enqueue.mjs';
import { initOutbox } from './outbox.mjs';
import { releaseFixture } from './test-fixture.mjs';

const cli = fileURLToPath(new URL('../nostr-presence.mjs', import.meta.url));
const revision = '29a62363a6ea449354b9a4036913e64fcfd57b47';

function home(t) {
  const root = mkdtempSync(join(tmpdir(), 'lkjstr-nostr-cli-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const presence = (...args) => spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8', env: { ...process.env, LKJSTR_SHIP_STATE_DIR: root },
  });
  return { root, store: join(root, 'lkjstr-nostr'), presence };
}

const fileHash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const schema = path => {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db.prepare('SELECT type, name, sql FROM sqlite_master ORDER BY type, name').all();
  } finally {
    db.close();
  }
};

test('read commands leave a store from before the queue redesign untouched instead of migrating it', t => {
  const { store, presence } = home(t);
  mkdirSync(store, { mode: 0o700 });
  const path = join(store, 'presence.sqlite3');
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE releases (revision TEXT PRIMARY KEY, verified_at INTEGER NOT NULL, receipt TEXT NOT NULL) STRICT;
    CREATE TABLE announcements (revision TEXT PRIMARY KEY REFERENCES releases, draft_sha256 TEXT, approval TEXT,
      content TEXT, approved_at INTEGER, event_id TEXT UNIQUE, event TEXT, delivered_at INTEGER) STRICT;`);
  db.close();
  const before = { bytes: fileHash(path), schema: schema(path), files: readdirSync(store).sort() };
  for (const args of [['served', 'a'.repeat(32), 'b'.repeat(64)], ['ready'], ['releases'], ['inspect', revision]]) {
    assert.equal(presence(...args).status, 1, args[0]);
  }
  assert.deepEqual({ bytes: fileHash(path), schema: schema(path), files: readdirSync(store).sort() }, before);
});

test('a read command never creates a missing store', t => {
  const { store, presence } = home(t);
  assert.equal(presence('served', 'a'.repeat(32), 'b'.repeat(64)).status, 1);
  assert.equal(existsSync(store), false);
});

test('read commands answer from a current store without writing it, and writers still initialize', t => {
  const { store, presence } = home(t);
  const db = openState(store);
  initOutbox(db);
  const receipt = releaseFixture(db, revision, 1795240000);
  db.close();
  const path = join(store, 'presence.sqlite3');
  const before = fileHash(path);
  const answer = presence('served', receipt.current, receipt.archive);
  assert.equal(answer.status, 0, answer.stderr);
  assert.deepEqual(JSON.parse(answer.stdout), { queued: true, revision, verifiedAt: 1795240000 });
  assert.equal(JSON.parse(presence('served', receipt.current, 'c'.repeat(64)).stdout).queued, false);
  assert.equal(JSON.parse(presence('releases').stdout)[0].revision, revision);
  assert.equal(fileHash(path), before);
  assert.equal(schema(path).some(row => row.name === 'feedback'), false);
  assert.equal(presence('ack-feedback', 'd'.repeat(64)).status, 0);
  assert.equal(schema(path).some(row => row.name === 'feedback'), true);
});
