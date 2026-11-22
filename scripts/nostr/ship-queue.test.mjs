import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { enqueue, openState } from '../nostr-enqueue.mjs';
import { fixture, deploys } from '../ship-test-support.mjs';

test('a quiet ship durably enqueues both exact host receipts once per revision', t => {
  const f = fixture(t);
  assert.equal(f.run('', { LKJSTR_SHIP_NOTIFY: '0' }).status, 0);
  const runName = readdirSync(join(f.root, 'tmp')).find(name => /^ship-\d/.test(name));
  const run = join(f.root, 'tmp', runName);
  const store = join(f.state, 'lkjstr-nostr');
  const first = enqueue(store, run);
  assert.equal(first.queued, false);
  const db = openState(store);
  try {
    const rows = db.prepare('SELECT receipt FROM releases').all();
    assert.equal(rows.length, 1);
    const receipt = JSON.parse(rows[0].receipt);
    assert.equal(receipt.revision, f.git(['rev-parse', 'HEAD']).trim());
    assert.equal(receipt.archive, first.archive);
    assert.equal(receipt.origin, 'https://lkjstr.lkjsxc.com');
    assert.equal(receipt.host.first.deploy, readFileSync(join(run, 'deploy-first.json'), 'utf8'));
    assert.equal(receipt.host.first.verify, readFileSync(join(run, 'verify-first.json'), 'utf8'));
    writeFileSync(join(run, 'verify-first.json'), '{}');
    assert.throws(() => enqueue(store, run), /Retained host receipts/);
  } finally {
    db.close();
  }
});

test('a verified enqueue failure preserves shipment and permits separate receipt recovery', t => {
  const f = fixture(t);
  const store = join(f.state, 'lkjstr-nostr');
  mkdirSync(store, { recursive: true, mode: 0o755 });
  const result = f.run('', { LKJSTR_SHIP_NOTIFY: '0' });
  assert.equal(result.status, 1, result.log);
  assert.match(result.summary, /^SHIPPED .*Nostr enqueue failed/);
  assert.equal(deploys(f.events()).length, 1);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), true);
  rmdirSync(store);
  const runName = readdirSync(join(f.root, 'tmp')).find(name => /^ship-\d/.test(name));
  assert.equal(enqueue(store, join(f.root, 'tmp', runName)).queued, true);
  assert.equal(deploys(f.events()).length, 1);
});
