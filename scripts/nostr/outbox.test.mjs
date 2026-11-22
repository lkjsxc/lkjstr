import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { openState, sha256 } from '../nostr-enqueue.mjs';
import { ORIGIN, RELAYS } from './event.mjs';
import { inspect, publish, ready, recordExisting } from './outbox.mjs';
import { legacyReceipt } from './legacy-receipt.mjs';
import { packet, stage } from './review.mjs';
import { frame, loopback, releaseFixture, signed, stateFixture } from './test-fixture.mjs';

const revision = '29a62363a6ea449354b9a4036913e64fcfd57b47';
const base = '7b07411a0f9090c416987d8adbf8f537d6165606';
const timestamp = 1795240000;

function approval(directory, draft, changes = {}) {
  const draftPath = join(directory, 'draft.json');
  const reviewPath = join(directory, 'review.json');
  writeFileSync(draftPath, JSON.stringify(draft));
  const digest = sha256(readFileSync(draftPath));
  writeFileSync(reviewPath, JSON.stringify({ reviewer: 'claude', verdict: 'approved',
    draft_sha256: digest, nip89: 'unchanged', evidence: 'fixture review', ...changes }));
  return [draftPath, reviewPath];
}

test('review binds exact source, original draft bytes and a single batched membership', t => {
  const { db, directory } = stateFixture(t);
  releaseFixture(db, revision, timestamp);
  releaseFixture(db, base, timestamp - 10);
  assert.equal(packet(db, revision, [base]).nip89.changed, false);
  const draft = { release: revision, batch: [base], source: 'neon',
    en: 'Tested an example.', ja: '例を確認しました。', evidence: 'fixture writer' };
  assert.throws(() => stage(db, ...approval(directory, draft, { draft_sha256: '0'.repeat(64) })), /exact draft/);
  assert.throws(() => stage(db, ...approval(directory, { ...draft, en: 'See https://example.org' })), /prose/);
  assert.throws(() => stage(db, ...approval(directory, { ...draft, en: 'See lkjstr.com' })), /prose/);
  assert.throws(() => stage(db, ...approval(directory, { ...draft, release: base, batch: [revision] })), /ancestors/);
  const files = approval(directory, draft);
  assert.equal(stage(db, ...files).alreadyStaged, false);
  assert.equal(stage(db, ...files).alreadyStaged, true);
  const info = inspect(db, base);
  assert.equal(info.announcement.revision, revision);
  assert.equal(info.announcement.content, `Tested an example.\n\n例を確認しました。\n\n${ORIGIN}`);
  assert.deepEqual(JSON.parse(info.announcement.approval.draft), draft);
  const independent = { ...draft, release: base, batch: [], source: 'claude' };
  assert.throws(() => stage(db, ...approval(directory, independent)), /another release/);
});

test('an ambiguous send reuses exactly one signature across DB reopen and retains exact relay proof', async t => {
  const { db, directory } = stateFixture(t);
  releaseFixture(db, revision, timestamp);
  db.prepare('INSERT INTO announcements (revision, approval, content) VALUES (?, ?, ?)').run(revision, '{}', 'test');
  const sent = [];
  let readbackEnabled = false;
  const relay = await loopback(t, (socket, [type, target]) => {
    if (type === 'EVENT') {
      sent.push(target);
      frame(socket, 'OK', target.id, true);
    } else {
      if (sent.length) frame(socket, 'EVENT', target, readbackEnabled ? sent.at(-1) : {
        ...sent.at(-1), sig: '0'.repeat(128),
      });
      frame(socket, 'EOSE', target);
    }
  });
  let signs = 0;
  const sign = (...args) => { signs++; return signed(...args); };
  const options = { relays: [relay], clock: () => timestamp };
  const first = await publish(db, revision, sign, options);
  assert.equal(first.status, 'unconfirmed');
  assert.equal(sent.length, 1);
  assert.equal(db.prepare('SELECT sent_at FROM attempts').get().sent_at, timestamp);
  assert.equal(db.prepare('SELECT event_id FROM announcements').get().event_id, sent[0].id);
  const reopened = openState(directory);
  let second;
  try {
    second = await publish(reopened, revision, sign, options);
  } finally {
    reopened.close();
  }
  assert.deepEqual(second, first);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[1], sent[0]);
  readbackEnabled = true;
  const last = await publish(db, revision, sign, options);
  assert.deepEqual(last, { id: first.id, status: 'delivered' });
  assert.equal(signs, 1);
  assert.equal(sent.length, 2);
  const result = db.prepare('SELECT readbacks FROM attempts ORDER BY id DESC LIMIT 1').get();
  assert.deepEqual(JSON.parse(result.readbacks)[0].event, sent[0]);
  assert.deepEqual(await publish(db, revision, sign, options), last);
  assert.equal(sent.length, 2);
});

test('concurrent release candidates share the durable rolling ceiling and reset after a day', async t => {
  const { db } = stateFixture(t);
  const revisions = ['1', '2', '3'].map(char => char.repeat(40));
  for (const rev of revisions) {
    releaseFixture(db, rev, timestamp);
    db.prepare('INSERT INTO announcements (revision, approval, content) VALUES (?, ?, ?)').run(rev, '{}', 'same text');
  }
  let now = timestamp;
  const sent = [];
  const read = async relay => ({ relay, status: 'complete' });
  const send = async (relay, event) => {
    assert.equal(db.prepare('SELECT event_id FROM announcements WHERE event_id = ?').get(event.id).event_id, event.id);
    assert.ok(db.prepare(`SELECT 1 FROM attempts WHERE status = 'sending' AND sent_at = ?`).get(now));
    sent.push(event);
    return { relay, status: 'accepted' };
  };
  const options = { relays: ['fixture'], read, send, clock: () => now };
  const results = await Promise.all(revisions.map(rev => publish(db, rev, signed, options)));
  assert.equal(sent.length, 2);
  assert.equal(new Set(sent.map(event => event.id)).size, 2);
  const throttled = results.findIndex(result => result.status === 'daily-cap');
  assert.notEqual(throttled, -1);
  const selection = ready(db, now);
  assert.equal(selection.usedInRollingDay, 2);
  assert.equal(selection.nextNewSlotAt, now + 86401);
  assert.equal(selection.approved.find(row => row.revision === revisions[throttled]).status, 'daily-cap');
  now += 86401;
  const next = await publish(db, revisions[throttled], () => assert.fail('signed twice'), options);
  assert.equal(next.id, results[throttled].id);
  assert.equal(sent.length, 3);
  await assert.rejects(recordExisting(db, revisions[0], signed(ORIGIN, revisions[0], now), options), /original signed app/);
});

test('the earlier publisher receipt must name the supplied event and distinct known relays', t => {
  const { directory } = stateFixture(t);
  const receipt = join(directory, 'previous-proof.json');
  const event = { id: 'f'.repeat(64) };
  const observation = { kind: 1, id: event.id, relay: RELAYS[0],
    acknowledgment: 'accepted', readback: 'exact-event' };
  writeFileSync(receipt, JSON.stringify([observation]));
  const proof = legacyReceipt(receipt, event);
  assert.equal(proof.evidence.sha256, sha256(readFileSync(receipt)));
  assert.deepEqual(proof.readbacks, [{ relay: RELAYS[0], status: 'exact-event' }]);
  for (const rows of [[observation, observation],
    [{ ...observation, id: '0'.repeat(64) }], [{ ...observation, readback: 'timeout' }]]) {
    writeFileSync(receipt, JSON.stringify(rows));
    assert.throws(() => legacyReceipt(receipt, event), /exact readback/);
  }
});
