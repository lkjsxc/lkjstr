import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteRow, Query } from '../src/engine/protocol.ts';
import { readPublicSnapshot, snapshotIdentity } from '../src/engine/public-snapshot-store.ts';
import { rowTime } from '../src/views/feed-scrub.ts';
import { harness, note } from './public-snapshots-support.ts';

const profile = 'b'.repeat(64);
const all: Query = { source: 'profile', pubkey: profile, show: 'all' };
const articles: Query = { ...all, show: 'articles' };
const lists: Query = { ...all, show: 'lists' };
const base = note('c'.repeat(64));
const generic: NoteRow = {
  ...base,
  eventKind: 30311,
  copyLink: '/a/naddr1publicreference',
  face: {
    type: 'generic',
    alt: 'Public event',
    form: 'text',
    tags: [
      {
        name: 'p',
        text: 'Known author',
        meaning: 'person',
        ref: { type: 'person', pubkey: profile },
      },
      { name: 't', text: 'nostr', meaning: 'topic', ref: { type: 'topic', tag: 'nostr' } },
      { name: 'custom', text: 'long unknown value' },
    ],
    moreTags: 2,
  },
};
const peers: ReturnType<typeof harness>[] = [];
function client() {
  const h = harness();
  peers.push(h);
  return h;
}
const at = (q: Query) => snapshotIdentity(q, 'en', true);
const cache = (h: ReturnType<typeof harness>) =>
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
const seen = (h: ReturnType<typeof harness>) => h.messages.filter((frame) => frame.t === 'rows');
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  for (const h of peers.splice(0)) h.transport.close();
  vi.clearAllTimers();
  vi.useRealTimers();
  localStorage.clear();
});

it('preserves typed generic face and canonical copy reference in an ordinary top snapshot', async () => {
  const first = client();
  first.open(all);
  cache(first);
  first.rows([generic]);
  await vi.advanceTimersByTimeAsync(201);
  first.transport.close();
  expect(readPublicSnapshot(at(all), 'top')?.rows).toEqual([generic]);
  expect(readPublicSnapshot(at(articles), 'top')).toBeUndefined();
  expect(readPublicSnapshot(at(lists), 'top')).toBeUndefined();
  const cold = client();
  cold.open(all);
  await vi.advanceTimersByTimeAsync(0);
  expect(seen(cold).map((frame) => frame.rows)).toEqual([[generic]]);
});

it('does not persist scoped generic faces into ordinary top windows', async () => {
  const scoped = client();
  scoped.open(all);
  scoped.transport.post({ t: 'window', sub: 'one', anchor: { at: 1000 }, before: 0, after: 60 });
  cache(scoped);
  scoped.rows([{ ...generic, readingAt: 1000 }]);
  await vi.advanceTimersByTimeAsync(201);
  scoped.transport.close();
  expect(readPublicSnapshot(at(all), 'top')).toBeUndefined();
  const cold = client();
  cold.open(all);
  await vi.advanceTimersByTimeAsync(0);
  expect(seen(cold)).toEqual([]);
});

it('captures and replays authored All rows after live attribution is removed', async () => {
  const original: NoteRow = { ...note('d'.repeat(64)), at: 10_000 };
  const selfRepost: NoteRow = { ...note('e'.repeat(64)), eventKind: 6, at: 30_000 };
  const first = client();
  first.open(all);
  cache(first);
  first.rows([
    selfRepost,
    { ...original, repostedBy: { actors: [original.author], others: 0, at: 40_000 } },
  ]);
  await vi.advanceTimersByTimeAsync(201);
  first.transport.close();

  const refreshed = client();
  refreshed.open(all);
  await vi.advanceTimersByTimeAsync(0);
  cache(refreshed);
  refreshed.rows([selfRepost, original]);
  await vi.advanceTimersByTimeAsync(201);
  refreshed.transport.close();

  const expected = [selfRepost, original];
  expect(readPublicSnapshot(at(all), 'top')?.rows).toEqual(expected);
  const cold = client();
  cold.open(all);
  await vi.advanceTimersByTimeAsync(0);
  expect(seen(cold).map((frame) => frame.rows)).toEqual([expected]);
  expect(expected.map(rowTime)).toEqual([30_000, 10_000]);
  for (const row of expected) {
    expect(row.repostedBy).toBeUndefined();
    expect(row.readingAt).toBeUndefined();
  }
});

it('replays ordinary Profile Posts with scoped attribution and a separate posts-only snapshot', async () => {
  const posts: Query = { ...all, show: 'posts' };
  const postsOnly: Query = { ...posts, reposts: false };
  const original = note('1'.repeat(64));
  const repost = { ...generic, repostedBy: { actors: [original.author], others: 0, at: 3000 } };
  const first = client();
  first.open(posts);
  cache(first);
  first.rows([repost, original]);
  await vi.advanceTimersByTimeAsync(201);
  first.transport.close();

  const scoped = client();
  scoped.open(posts);
  scoped.transport.post({ t: 'window', sub: 'one', anchor: { at: 1000 }, before: 0, after: 60 });
  cache(scoped);
  scoped.rows([{ ...original, readingAt: 20_000 }]);
  await vi.advanceTimersByTimeAsync(201);
  scoped.transport.close();

  const cold = client();
  cold.open(posts);
  const hidden = client();
  hidden.open(postsOnly);
  await vi.advanceTimersByTimeAsync(0);
  expect(seen(cold).map((frame) => frame.rows)).toEqual([[repost, original]]);
  expect(seen(hidden)).toEqual([]);
  expect(readPublicSnapshot(at(posts), 'top')?.rows.map(rowTime)).toEqual([3000, 1000]);
});
