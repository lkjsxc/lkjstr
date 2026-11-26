import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Anchor, Query } from '../src/engine/protocol.ts';
import { snapshotIdentity } from '../src/engine/public-snapshot-store.ts';
import { learnMediaSize } from '../src/shared/public-media.ts';
import { harness, note } from './public-snapshots-support.ts';

const query: Query = { source: 'their-home', pubkey: 'a'.repeat(64) };
const identity = snapshotIdentity(query, 'en', true);
const storageKey = (slot: 'read' | 'top', key = identity) => `lkjstr:public-view:1:${slot}:${key}`;
const repost = note('1'.repeat(64));
const newer = { ...note('2'.repeat(64)), at: 20_000 };
const ordinary = [newer, repost];
const momentRepost = {
  ...repost,
  readingAt: 25_000,
  repostedBy: { actors: [repost.author], others: 0, at: 25_000 },
};
const moment = [momentRepost, { ...newer, readingAt: newer.at }];
const pivot = { at: 10_000 };
type Harness = ReturnType<typeof harness>;
const windowAt = (h: Harness, anchor: Anchor) =>
  h.transport.post({ t: 'window', sub: 'one', anchor, before: 0, after: 60 });
const openAt = (h: Harness, anchor: Anchor) => {
  h.transport.post({ t: 'open', sub: 'one', query });
  windowAt(h, anchor);
};
const allow = (h: Harness) => h.emit({ t: 'cache.policy', sub: 'one', allow: true });
const painted = (h: Harness) => h.messages.filter((message) => message.t === 'rows');

function seedSnapshot(key: string, rows: typeof ordinary): void {
  const body = JSON.stringify({ rows, anchor: rows[0]?.key, atTop: true, atBottom: false });
  let hash = 2166136261;
  for (let i = 0; i < body.length; i++) hash = Math.imul(hash ^ body.charCodeAt(i), 16777619);
  localStorage.setItem(
    key,
    JSON.stringify({ version: 2, seen: Date.now(), body, check: hash >>> 0 }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

it('does not save Moment order for a cold same-query keyed restore after Top', async () => {
  const h = harness();
  openAt(h, pivot);
  allow(h);
  h.rows([repost, newer]); // Older engines can send pivot order without a row marker.
  await vi.advanceTimersByTimeAsync(201);
  const unmarkedRead = localStorage.getItem(storageKey('read'));
  h.rows(moment);
  expect(painted(h).at(-1)?.rows).toEqual(moment);
  h.transport.post({ t: 'reading', sub: 'one', key: newer.key });
  await vi.advanceTimersByTimeAsync(201);
  windowAt(h, 'top');
  // A response already on its way from the pivot can arrive before the new head.
  h.rows(moment);
  h.transport.close();

  const cold = harness();
  openAt(cold, { key: newer.key });
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(cold)).toHaveLength(0);
  expect(cold.post.mock.calls.map(([message]) => message)).toEqual([
    { t: 'open', sub: 'one', query },
    { t: 'window', sub: 'one', anchor: { key: newer.key }, before: 0, after: 60 },
  ]);
  expect(unmarkedRead).toBeNull();
  expect(localStorage.getItem(storageKey('read'))).toBeNull();
  expect(localStorage.getItem(storageKey('top'))).toBeNull();
  cold.transport.close();
});

it('preserves ordinary snapshots across a reused subscription and resumes capture on Top', async () => {
  const first = harness();
  first.open(query);
  allow(first);
  first.rows(ordinary);
  first.transport.close();
  const readBefore = localStorage.getItem(storageKey('read'));
  expect(readBefore).toBeTruthy();

  const h = harness();
  openAt(h, { key: repost.key });
  windowAt(h, pivot); // Cancels a queued ordinary keyed paint.
  allow(h);
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(h)).toEqual([]);
  h.rows(moment);
  const url = 'https://images.test/moment-reveal.png';
  const revealed = {
    ...momentRepost,
    revealed: { reason: 'muted-person' as const },
    segments: [{ k: 'text' as const, text: 'Moment-only fixture body' }],
    media: [{ type: 'image' as const, url }],
  };
  h.emit({ t: 'patch', sub: 'one', ops: [{ op: 'update', row: revealed }] });
  learnMediaSize(url, 40, 20);
  await vi.advanceTimersByTimeAsync(201);
  expect(localStorage.getItem('lkjstr:public-media:1')).toBeNull();
  expect(localStorage.getItem(storageKey('read'))).toBe(readBefore);

  const updated = { ...newer, at: 21_000 };
  windowAt(h, 'top');
  h.emit({ t: 'patch', sub: 'one', ops: [{ op: 'remove', key: repost.key }] });
  expect(localStorage.getItem(storageKey('read'))).toBe(readBefore);
  h.rows([]);
  h.emit({ t: 'patch', sub: 'one', ops: [{ op: 'insert', before: null, rows: [revealed] }] });
  h.emit({ t: 'patch', sub: 'one', ops: [{ op: 'remove', key: repost.key }] });
  await vi.advanceTimersByTimeAsync(201);
  expect(localStorage.getItem('lkjstr:public-media:1')).toBeNull();
  expect(localStorage.getItem(storageKey('read'))).toBe(readBefore);
  h.rows([updated, repost]);
  h.transport.close();
  const cold = harness();
  openAt(cold, 'top');
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(cold)).toMatchObject([{ rows: [updated, repost] }]);
  expect(painted(cold)[0]?.rows.map((row) => Object.hasOwn(row, 'readingAt'))).toEqual([
    false,
    false,
  ]);
  cold.transport.close();
});

it.each(['read', 'top'] as const)(
  'rejects scoped reading times in an otherwise valid %s snapshot',
  async (slot) => {
    seedSnapshot(storageKey(slot), moment);
    const h = harness();
    openAt(h, slot === 'top' ? 'top' : { key: newer.key });
    await vi.advanceTimersByTimeAsync(0);
    expect(painted(h)).toEqual([]);
    expect(h.post.mock.calls.some(([message]) => message.t === 'cache.hold')).toBe(false);
    h.transport.close();
  },
);

it('rejects obsolete history and Profile Posts snapshots while keeping Profile All', async () => {
  const oldIdentity = JSON.stringify([
    'en',
    true,
    true,
    JSON.stringify({ pubkey: query.pubkey, source: 'their-home' }),
  ]);
  seedSnapshot(storageKey('read', oldIdentity), [repost, newer]);
  const oldHomeIdentity = JSON.stringify(['en', true, true, '{"source":"home"}']);
  seedSnapshot(storageKey('top', oldHomeIdentity), ordinary);
  const profilePosts: Query = { source: 'profile', pubkey: query.pubkey, show: 'posts' };
  const oldProfileIdentity = JSON.stringify([
    'en',
    true,
    true,
    JSON.stringify({ pubkey: query.pubkey, show: 'posts', source: 'profile' }),
  ]);
  seedSnapshot(storageKey('top', oldProfileIdentity), ordinary);
  const profileAll: Query = { ...profilePosts, show: 'all' };
  const allIdentity = JSON.stringify([
    'en',
    true,
    true,
    JSON.stringify({ pubkey: query.pubkey, show: 'all', source: 'profile' }),
  ]);
  seedSnapshot(storageKey('top', allIdentity), ordinary);

  const theirs = harness();
  openAt(theirs, { key: newer.key });
  const home = harness();
  home.open({ source: 'home' });
  const posts = harness();
  posts.open(profilePosts);
  const profile = harness();
  profile.open(profileAll);
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(theirs)).toEqual([]);
  expect(theirs.post.mock.calls.some(([message]) => message.t === 'cache.hold')).toBe(false);
  expect(painted(home)).toEqual([]);
  expect(painted(posts)).toEqual([]);
  expect(painted(profile)).toMatchObject([{ rows: ordinary }]);
  theirs.transport.close();
  home.transport.close();
  posts.transport.close();
  profile.transport.close();
});

it('captures the preview and expires it on same-query replay', async () => {
  vi.setSystemTime(100_000);
  const recent = { ...newer, at: 99_000 };
  const aged = { ...repost, at: 90_000 };
  const h = harness();
  openAt(h, 'top');
  h.emit({
    t: 'cache.policy',
    sub: 'one',
    allow: true,
    snapshotWindow: { maxAgeMs: 5_000 },
  });
  h.rows([recent, aged]);
  await vi.advanceTimersByTimeAsync(201);
  h.transport.close();
  const warm = harness();
  openAt(warm, 'top');
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(warm)).toMatchObject([{ rows: [recent] }]);
  warm.transport.close();
  vi.setSystemTime(106_000);
  const expired = harness();
  openAt(expired, 'top');
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(expired)).toEqual([]);
  expired.transport.close();
});
