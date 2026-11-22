import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { APP, NPUB, ORIGIN } from './event.mjs';
import { acknowledgeFeedback, listen } from './listen.mjs';
import { frame, loopback, signed, stateFixture } from './test-fixture.mjs';

const now = 1795240000;

test('advertised search and structured reads produce one deduplicated local backlog without any writes to relays', async t => {
  const { directory, db } = stateFixture(t);
  const seen = [];
  const about = signed(`lkjstrを試しました (${ORIGIN}/n/example)\n${NPUB}`,
    'mention', now - 60, { tags: [['p', APP]] });
  const invalid = { ...signed('lkjstr bad', 'invalid', now - 60), sig: '0'.repeat(128) };
  const spoof = signed('Example https://lkjstr.lkjsxc.com.example.org/', 'bad-host', now - 60);
  const unstated = signed('Some other app', 'other', now - 60);
  const old = signed('lkjstr old', 'old', now - 86400);
  const send = name => (socket, [type, sub, filter]) => {
    seen.push({ name, type, filter });
    if (type !== 'REQ') return;
    if (filter.search === 'lkjstr') frame(socket, 'EVENT', sub, invalid);
    for (const event of [about, spoof, unstated, old]) frame(socket, 'EVENT', sub, event);
    frame(socket, 'EOSE', sub);
  };
  const searchRelay = await loopback(t, send('search'));
  const baseRelay = await loopback(t, send('plain'), [1, 11]);
  const options = { relays: [searchRelay, baseRelay], clock: () => now };
  const outcome = await listen(db, directory, options);
  assert.equal(outcome.uniqueThisRun, 1);
  assert.equal(outcome.incomplete, 1);
  assert.ok(seen.every(row => row.type === 'REQ'));
  assert.ok(seen.filter(row => row.name === 'plain').every(row => !row.filter.search));
  assert.deepEqual(seen.filter(row => row.name === 'search' && row.filter.search).map(row => row.filter.search),
    ['lkjstr', NPUB, APP, 'lkjstr.lkjsxc.com']);
  const digest = JSON.parse(readFileSync(join(directory, 'feedback.json'), 'utf8'));
  assert.equal(digest.total, 1);
  assert.equal(digest.backlog[0].id, about.id);
  assert.deepEqual(digest.backlog[0].relays, [searchRelay, baseRelay].sort());
  assert.deepEqual(digest.backlog[0].matches, ['app-tag', 'link', 'name', 'npub']);
  const cursor = db.prepare('SELECT lane, frontier FROM feedback_cursor WHERE relay = ?').all(searchRelay);
  assert.equal(cursor.find(row => row.lane === 'search-name').frontier, now - 6 * 3600);
  assert.equal(cursor.find(row => row.lane === 'search-npub').frontier, now - 30);
  assert.equal(acknowledgeFeedback(db, [about.id]).acknowledged, 1);
  await listen(db, directory, options);
  assert.equal(JSON.parse(readFileSync(join(directory, 'feedback.json'), 'utf8')).total, 0);
  assert.equal(db.prepare('SELECT count(*) AS count FROM feedback').get().count, 1);
});

test('saturation shortens only its own lane, and a bounded later EOSE advances it', async t => {
  const { directory, db } = stateFixture(t);
  let dense = true;
  const relay = await loopback(t, (socket, [type, sub, filter]) => {
    assert.equal(type, 'REQ');
    const saturation = dense && filter['#p'];
    if (saturation) for (let index = 0; index < filter.limit; ++index) frame(socket, 'EVENT', sub, null);
    frame(socket, 'EOSE', sub);
  }, []);
  const options = { relays: [relay], clock: () => now };
  await listen(db, directory, options);
  let saved = db.prepare('SELECT lane, frontier, width FROM feedback_cursor').all();
  assert.equal(saved.find(row => row.lane === 'app-tag').width, 3 * 3600);
  assert.equal(saved.find(row => row.lane === 'app-tag').frontier, now - 6 * 3600);
  assert.equal(saved.find(row => row.lane === 'handler').frontier, now - 30);
  dense = false;
  await listen(db, directory, options);
  saved = db.prepare('SELECT lane, frontier, width FROM feedback_cursor').all();
  assert.equal(saved.find(row => row.lane === 'app-tag').frontier, now - 3 * 3600);
  assert.equal(saved.find(row => row.lane === 'app-tag').width, 6 * 3600);
});

test('oversized relay frames are cut off without advancing the lane', async t => {
  const { directory, db } = stateFixture(t);
  const relay = await loopback(t, socket => socket.send('x'.repeat(70 * 1024)), []);
  await listen(db, directory, { relays: [relay], clock: () => now });
  const digest = JSON.parse(readFileSync(join(directory, 'feedback.json'), 'utf8'));
  assert.ok(digest.reports[0].results.every(row => row.status === 'frame-too-large'));
  assert.ok(digest.reports[0].results.every(row => row.frontier === row.nextFrontier));
});

test('a dedicated search relay receives only advertised search and no requests when unavailable', async t => {
  const { directory, db } = stateFixture(t);
  const requests = [];
  const relay = await loopback(t, (socket, [type, sub, filter]) => {
    requests.push({ type, filter });
    frame(socket, 'EOSE', sub);
  });
  const options = { relays: [relay], searchOnly: [relay], clock: () => now };
  await listen(db, directory, options);
  assert.equal(requests.length, 4);
  assert.ok(requests.every(row => row.type === 'REQ' && row.filter.search));
  requests.length = 0;
  await listen(db, directory, { ...options, info: async () => 'unavailable' });
  assert.equal(requests.length, 0);
});
