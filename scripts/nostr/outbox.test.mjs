import assert from 'node:assert/strict';
import test from 'node:test';
import { openState } from '../nostr-enqueue.mjs';
import { inspect, publish, ready } from './outbox.mjs';
import { frame, loopback, releaseFixture, signed, sourceFixture, stateFixture } from './test-fixture.mjs';

const revision = '29a62363a6ea449354b9a4036913e64fcfd57b47';
const timestamp = 1795240000;

test('an ambiguous send reuses exactly one signature across DB reopen and retains exact relay proof', async t => {
  const { db, directory } = stateFixture(t);
  releaseFixture(db, revision, timestamp);
  db.prepare('INSERT INTO announcements (revision, approval, content) VALUES (?, ?, ?)').run(revision, '{}', 'test');
  db.prepare('INSERT INTO announcement_members VALUES (?, ?)').run(revision, revision);
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

test('every approved note starts its send at once, with no rolling ceiling', async t => {
  const { db } = stateFixture(t);
  const { commit, git } = sourceFixture(t);
  const revisions = ['one', 'two', 'three'].map(subject => commit(subject));
  for (const rev of revisions) {
    releaseFixture(db, rev, timestamp);
    db.prepare('INSERT INTO announcements (revision, approval, content, approved_at) VALUES (?, ?, ?, ?)')
      .run(rev, '{}', 'same text', timestamp);
    db.prepare('INSERT INTO announcement_members VALUES (?, ?)').run(rev, rev);
    db.prepare('INSERT INTO coverage VALUES (?, NULL)').run(rev);
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
  assert.deepEqual(results.map(result => result.status), ['unconfirmed', 'unconfirmed', 'unconfirmed']);
  assert.equal(new Set(sent.map(event => event.id)).size, 3);
  now += 600;
  const state = ready(db, { git, now });
  assert.deepEqual(Object.keys(state), ['next', 'awaitingReview', 'approved']);
  assert.deepEqual(state.approved.map(row => row.status), ['ready', 'ready', 'ready']);
  const retry = await publish(db, revisions[2], () => assert.fail('signed twice'), options);
  assert.equal(retry.id, results[2].id);
  assert.equal(sent.length, 4);
  assert.deepEqual(sent[3], sent.find(event => event.id === retry.id));
  assert.deepEqual(inspect(db, revisions[2]).attempts.map(row => row.status), ['unconfirmed', 'unconfirmed']);
});
