import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { enqueue, openState, shipReceipt } from '../nostr-enqueue.mjs';
import { fixture, deploys } from '../ship-test-support.mjs';

const runs = f => readdirSync(join(f.root, 'tmp')).filter(name => /^ship-\d/.test(name)).sort()
  .map(name => join(f.root, 'tmp', name));
const rows = (store, sql) => {
  const db = openState(store);
  try {
    return db.prepare(sql).all();
  } finally {
    db.close();
  }
};

test('a quiet ship durably enqueues both exact host receipts once per revision', t => {
  const f = fixture(t);
  assert.equal(f.run('', { LKJSTR_SHIP_NOTIFY: '0' }).status, 0);
  const [run] = runs(f);
  const store = join(f.state, 'lkjstr-nostr');
  assert.match(readFileSync(join(run, 'summary'), 'utf8'), /\nverified_at=\d+\n$/);
  const first = enqueue(store, run);
  assert.equal(first.queued, false);
  const [release] = rows(store, 'SELECT receipt FROM releases');
  const receipt = JSON.parse(release.receipt);
  assert.equal(receipt.revision, f.git(['rev-parse', 'HEAD']).trim());
  assert.equal(receipt.archive, first.archive);
  assert.equal(receipt.origin, 'https://lkjstr.lkjsxc.com');
  assert.equal(receipt.host.first.deploy, readFileSync(join(run, 'deploy-first.json'), 'utf8'));
  assert.equal(receipt.host.first.verify, readFileSync(join(run, 'verify-first.json'), 'utf8'));
  assert.deepEqual(rows(store, 'SELECT current, archive FROM deployments').map(row => [row.current, row.archive]),
    [[receipt.current, receipt.archive]]);
  assert.throws(() => enqueue(store, run, '1795240000'), /does not identify a verified release/);
  writeFileSync(join(run, 'verify-first.json'), '{}');
  assert.throws(() => enqueue(store, run), /Retained host receipts/);
});

test('a verified enqueue failure ships, keeps its receipts outside the worktree and recovers without a deploy', t => {
  const f = fixture(t);
  const store = join(f.state, 'lkjstr-nostr');
  mkdirSync(store, { recursive: true, mode: 0o755 });
  const result = f.run('', { LKJSTR_SHIP_NOTIFY: '0' });
  assert.equal(result.status, 1, result.log);
  const [run] = runs(f);
  const kept = join(f.state, 'lkjstr-ship-evidence', run.split('/').at(-1));
  assert.match(result.summary, /^SHIPPED .*Nostr enqueue failed \(recover from (.*)\)$/m);
  assert.equal(result.summary.match(/recover from (.*)\)/)[1], kept);
  assert.equal(deploys(f.events()).length, 1);
  assert.equal(existsSync(join(f.state, 'lkjstr-last-ship')), true);
  rmSync(run, { recursive: true, force: true });
  rmdirSync(store);
  assert.equal(enqueue(store, kept).queued, true);
  assert.equal(deploys(f.events()).length, 1);
  assert.equal(JSON.parse(rows(store, 'SELECT receipt FROM releases')[0].receipt).run, kept);
});

test('shipping the same revision again keeps the first release receipt and adds the new deployment', t => {
  const f = fixture(t);
  assert.equal(f.run('', { LKJSTR_SHIP_NOTIFY: '0' }).status, 0);
  assert.equal(f.run('', { LKJSTR_SHIP_NOTIFY: '0' }).status, 0);
  assert.equal(deploys(f.events()).length, 2);
  const store = join(f.state, 'lkjstr-nostr');
  const [first, second] = runs(f).map(run => shipReceipt(run));
  assert.notEqual(first.current, second.current);
  assert.deepEqual(rows(store, 'SELECT current FROM deployments ORDER BY verified_at, current')
    .map(row => row.current).sort(), [first.current, second.current].sort());
  assert.equal(JSON.parse(rows(store, 'SELECT receipt FROM releases')[0].receipt).current, first.current);
});

test('a run retained before the hook needs its verified time, and only that time', t => {
  const f = fixture(t);
  assert.equal(f.run('', { LKJSTR_SHIP_NOTIFY: '0' }).status, 0);
  const [run] = runs(f);
  const older = join(f.state, 'older-run');
  cpSync(run, older, { recursive: true });
  const summary = join(older, 'summary');
  writeFileSync(summary, readFileSync(summary, 'utf8').replace(/verified_at=\d+\n$/, ''));
  assert.throws(() => shipReceipt(older), /does not identify a verified release/);
  assert.equal(shipReceipt(older, '1795310525').verifiedAt, 1795310525);
});
