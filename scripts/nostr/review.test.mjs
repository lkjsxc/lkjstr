import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { insertRelease, sha256 } from '../nostr-enqueue.mjs';
import { ORIGIN } from './event.mjs';
import { publish, ready, served } from './outbox.mjs';
import { packet, stage } from './review.mjs';
import { releaseFixture, signed, sourceFixture, stateFixture } from './test-fixture.mjs';

const host = revision => revision.slice(0, 32);
const subjects = gap => gap.commits.map(commit => commit.subject);

// A note that went out before this queue existed: `since` null describes the whole history.
function announced(db, revision, since, deliveredAt) {
  db.prepare(`INSERT INTO announcements (revision, content, event_id, event, delivered_at)
    VALUES (?, ?, ?, ?, ?)`).run(revision, 'earlier note', revision.slice(0, 8).padEnd(64, 'e'), '{}', deliveredAt);
  db.prepare('INSERT INTO announcement_members VALUES (?, ?)').run(revision, revision);
  db.prepare('INSERT INTO coverage VALUES (?, ?)').run(revision, since);
}

function approval(directory, draft, packetSha256, changes = {}) {
  const draftPath = join(directory, 'draft.json');
  const reviewPath = join(directory, 'review.json');
  writeFileSync(draftPath, JSON.stringify(draft));
  writeFileSync(reviewPath, JSON.stringify({ reviewer: 'claude', verdict: 'approved',
    draft_sha256: sha256(readFileSync(draftPath)), packet_sha256: packetSha256, nip89: 'unchanged',
    evidence: 'fixture review', ...changes }));
  return [draftPath, reviewPath];
}

const note = (release, batch, en = 'Everything since the last note.') =>
  ({ release, batch, source: 'claude', en, evidence: 'fixture writer' });

test('an already announced descendant leaves its omitted ancestor and partial range in the next packet', t => {
  const { db, directory } = stateFixture(t);
  const { commit, git, listing } = sourceFixture(t);
  const options = { git, listing };
  const floor = commit('floor');
  releaseFixture(db, floor, 100);
  announced(db, floor, null, 110);
  commit('omitted one');
  const omitted = commit('omitted two');
  releaseFixture(db, omitted, 200, host(floor));
  commit('undescribed middle');
  const since = commit('partial start');
  commit('described one');
  const partial = commit('described two');
  releaseFixture(db, partial, 300, host(omitted));
  announced(db, partial, since, 310);
  const next = commit('next');
  releaseFixture(db, next, 400, host(partial));

  const facts = packet(db, next, options);
  assert.deepEqual(facts.gaps.map(gap => gap.release), [omitted, partial, next]);
  assert.deepEqual(facts.gaps.map(subjects), [['omitted one', 'omitted two'],
    ['undescribed middle', 'partial start'], ['next']]);
  assert.deepEqual(facts.gaps.map(gap => [gap.replaced, gap.announcement]),
    [[floor, null], [omitted, partial], [partial, null]]);
  assert.deepEqual(facts.batch, [omitted]);
  assert.deepEqual(facts.lastDelivered, { announcement: partial, eventId: partial.slice(0, 8).padEnd(64, 'e'),
    deliveredAt: 310, since });
  assert.equal(facts.nip89.changed, false);
  assert.deepEqual(packet(db, next, options), facts);
  const state = ready(db, options);
  assert.equal(state.next, next);
  assert.deepEqual(state.awaitingReview.map(row => [row.revision, row.undescribed]),
    [[next, 5], [partial, 4], [omitted, 2]]);

  const draft = note(next, [omitted]);
  assert.throws(() => stage(db, ...approval(directory, note(next, []), facts.sha256), options), /exactly the packet/);
  assert.throws(() => stage(db, ...approval(directory, draft, '0'.repeat(64)), options), /different release packet/);
  assert.throws(() => stage(db, ...approval(directory, draft, facts.sha256, { draft_sha256: '0'.repeat(64) }),
    options), /exact draft and packet/);
  assert.throws(() => stage(db, ...approval(directory, note(next, [omitted], 'See lkjstr.com'), facts.sha256),
    options), /prose/);
  const files = approval(directory, draft, facts.sha256);
  assert.equal(stage(db, ...files, options).alreadyStaged, false);
  assert.equal(stage(db, ...files, options).alreadyStaged, true);
  const row = db.prepare('SELECT content, approval FROM announcements WHERE revision = ?').get(next);
  assert.equal(row.content, `Everything since the last note.\n\n${ORIGIN}`);
  assert.equal(JSON.parse(row.approval).facts.sha256, facts.sha256);
  assert.equal(db.prepare('SELECT since FROM coverage WHERE announcement = ?').get(next).since, null);
  assert.deepEqual(db.prepare('SELECT revision FROM announcement_members WHERE announcement = ? ORDER BY revision')
    .all(next).map(member => member.revision), [next, omitted].sort());
  const after = ready(db, options);
  assert.equal(after.next, null);
  assert.deepEqual(after.awaitingReview, []);
  assert.deepEqual(after.approved.map(approved => [approved.revision, approved.status]), [[next, 'ready']]);
  assert.deepEqual(packet(db, omitted, options).gaps, []);
  assert.throws(() => stage(db, ...approval(directory, note(omitted, []), packet(db, omitted, options).sha256),
    options), /Nothing in this release/);
});

test('a late ancestor voids the review, and an approved note stays exact when another ship arrives', async t => {
  const { db, directory } = stateFixture(t);
  const { commit, git, listing } = sourceFixture(t);
  const options = { git, listing };
  const floor = commit('floor');
  releaseFixture(db, floor, 100);
  announced(db, floor, null, 110);
  const late = commit('late ancestor');
  const release = commit('release');
  releaseFixture(db, release, 300, host(late));
  const reviewed = packet(db, release, options);
  assert.deepEqual(reviewed.batch, []);
  releaseFixture(db, late, 200, host(floor));
  assert.throws(() => stage(db, ...approval(directory, note(release, []), reviewed.sha256), options),
    /different release packet/);
  const current = packet(db, release, options);
  assert.deepEqual(current.batch, [late]);
  const files = approval(directory, note(release, [late]), current.sha256);
  stage(db, ...files, options);
  const staged = db.prepare('SELECT content, approval FROM announcements WHERE revision = ?').get(release);

  const arrived = commit('arrived after approval');
  releaseFixture(db, arrived, 400, host(release));
  const state = ready(db, options);
  assert.equal(state.next, arrived);
  assert.deepEqual(state.awaitingReview.map(row => row.revision), [arrived]);
  assert.deepEqual(state.approved.map(row => [row.revision, row.status]), [[release, 'ready']]);
  assert.equal(stage(db, ...files, options).alreadyStaged, true);
  assert.deepEqual(db.prepare('SELECT content, approval FROM announcements WHERE revision = ?').get(release), staged);

  const sent = [];
  const relayOptions = { relays: ['fixture'], clock: () => 500,
    read: async (relay, filter, match) => ({ relay, status: sent.some(match) ? 'exact-event' : 'complete' }),
    send: async (relay, event) => { sent.push(event); return { relay, status: 'accepted' }; } };
  const delivered = await publish(db, release, signed, relayOptions);
  assert.equal(delivered.status, 'delivered');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content, staged.content);
  const following = packet(db, arrived, options);
  assert.deepEqual(following.gaps.map(subjects), [['arrived after approval']]);
  assert.deepEqual(following.lastDelivered, { announcement: release, eventId: delivered.id,
    deliveredAt: 500, since: null });
});

test('an announcement without recorded coverage stops packets until the one-time backfill', t => {
  const { db } = stateFixture(t);
  const { commit, git, listing } = sourceFixture(t);
  const earlier = commit('earlier');
  releaseFixture(db, earlier, 100);
  db.prepare('INSERT INTO announcements (revision, content) VALUES (?, ?)').run(earlier, 'earlier note');
  const revision = commit('release');
  releaseFixture(db, revision, 200, host(earlier));
  assert.throws(() => packet(db, revision, { git, listing }), /coverage backfill/);
  assert.throws(() => ready(db, { git }), /coverage backfill/);
});

test('a served host release matches only its exact verified deployment', t => {
  const { db } = stateFixture(t);
  const revision = '1'.repeat(40);
  const first = releaseFixture(db, revision, 100);
  assert.deepEqual(served(db, first.current, first.archive), { queued: true, revision, verifiedAt: 100 });
  assert.deepEqual(served(db, first.current, 'c'.repeat(64)), { queued: false });
  assert.deepEqual(served(db, '2'.repeat(32), first.archive), { queued: false });
  const again = { ...first, current: '2'.repeat(32), first: '2'.repeat(32), verifiedAt: 200 };
  assert.equal(insertRelease(db, again).queued, false);
  assert.deepEqual(served(db, again.current, again.archive), { queued: true, revision, verifiedAt: 200 });
  assert.equal(JSON.parse(db.prepare('SELECT receipt FROM releases').get().receipt).verifiedAt, 100);
  assert.throws(() => insertRelease(db, { ...again, revision: '3'.repeat(40) }), /different verified deployment/);
});

test('a rolled-back primary does not credit its own source to a newer release verified earlier', t => {
  const { db } = stateFixture(t);
  const { commit, git, listing } = sourceFixture(t);
  const floor = commit('floor');
  releaseFixture(db, floor, 100);
  announced(db, floor, null, 110);
  const older = commit('older');
  const newer = commit('newer');
  releaseFixture(db, newer, 200, host(floor));
  releaseFixture(db, older, 300, host(newer));
  const facts = packet(db, older, { git, listing });
  assert.deepEqual(facts.gaps.map(gap => [gap.release, subjects(gap)]), [[older, ['older']]]);
  assert.deepEqual(facts.batch, []);
});
