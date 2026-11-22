import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Anchor, FromEngine, NoteRow, Query } from '../src/engine/protocol.ts';
import { readPublicSnapshot, snapshotIdentity } from '../src/engine/public-snapshot-store.ts';
import { harness, note } from './public-snapshots-support.ts';

const query: Query = { source: 'their-home', pubkey: 'a'.repeat(64) };
const identity = snapshotIdentity(query, 'en', true);
const article: NoteRow = {
  ...note('1'.repeat(64)),
  eventKind: 30023,
  at: 20_000,
  quotes: [
    {
      state: 'ok',
      eventKind: 30030,
      id: '3'.repeat(64),
      author: note().author,
      at: 9000,
      segments: [{ k: 'text', text: 'A verified public emoji set' }],
      media: [],
    },
  ],
};
const older = note('2'.repeat(64));
const ordinary = [article, older];
const scopedOnly: NoteRow = {
  ...note('4'.repeat(64)),
  eventKind: 1063,
  at: 30_000,
  readingAt: 30_000,
  quotes: [
    {
      state: 'ok',
      eventKind: 30311,
      id: '5'.repeat(64),
      author: article.author,
      at: 25_000,
      segments: [{ k: 'text', text: 'A verified public live event' }],
      media: [],
    },
  ],
};
const scoped = [scopedOnly, { ...older, readingAt: 25_000 }, { ...article, readingAt: article.at }];
const updatedScoped: NoteRow = {
  ...scopedOnly,
  counts: {
    ...scopedOnly.counts,
    replies: 8,
    context: {
      lineage: 'fixture',
      generation: '2',
      token: 'scoped-update',
      restored: true,
      current: true,
    },
  },
};
const scopedPatch: FromEngine = {
  t: 'patch',
  sub: 'one',
  ops: [{ op: 'update', row: updatedScoped }],
};
const pivot: Anchor = { at: 10_000 };
const ordinaryAnchors: Anchor[] = ['top', { key: older.key }];
type Harness = ReturnType<typeof harness>;
let clients: Harness[] = [];

function client(): Harness {
  const h = harness();
  clients.push(h);
  return h;
}
const windowAt = (h: Harness, anchor: Anchor) =>
  h.transport.post({ t: 'window', sub: 'one', anchor, before: 0, after: 60 });
const openAt = (h: Harness, anchor: Anchor) => {
  h.transport.post({ t: 'open', sub: 'one', query });
  windowAt(h, anchor);
};
const allow = (h: Harness) => h.emit({ t: 'cache.policy', sub: 'one', allow: true });
const painted = (h: Harness) => h.messages.filter((message) => message.t === 'rows');

async function saveOrdinary(): Promise<void> {
  const first = client();
  openAt(first, 'top');
  allow(first);
  first.rows(ordinary);
  await vi.advanceTimersByTimeAsync(201);
  first.transport.close();
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  clients = [];
});
afterEach(() => {
  for (const h of clients) h.transport.close();
  vi.useRealTimers();
  localStorage.clear();
});

it.each(ordinaryAnchors)(
  'round-trips note and quote event kinds through an ordinary %j snapshot',
  async (anchor) => {
    await saveOrdinary();
    expect(readPublicSnapshot(identity, anchor)?.rows).toEqual(ordinary);

    const cold = client();
    openAt(cold, anchor);
    await vi.advanceTimersByTimeAsync(0);
    expect(painted(cold).map((message) => message.rows)).toEqual([ordinary]);
    expect(cold.messages).toContainEqual({
      t: 'state',
      sub: 'one',
      state: { phase: 'cache', relaysAsked: 0, relaysAnswered: 0 },
    });
  },
);

it('retains event kinds in scoped live rows and patches without capturing or replaying them', async () => {
  const h = client();
  openAt(h, pivot);
  allow(h);
  h.rows(scoped);
  h.emit(scopedPatch);
  expect(painted(h).map((message) => message.rows)).toEqual([scoped]);
  expect(h.messages.at(-1)).toEqual(scopedPatch);
  await vi.advanceTimersByTimeAsync(201);
  h.transport.close();

  for (const anchor of ordinaryAnchors) {
    expect(readPublicSnapshot(identity, anchor)).toBeUndefined();
    const cold = client();
    openAt(cold, anchor);
    await vi.advanceTimersByTimeAsync(0);
    expect(painted(cold)).toEqual([]);
    expect(cold.post.mock.calls.some(([message]) => message.t === 'cache.hold')).toBe(false);
  }
});

it('keeps ordinary kind metadata and order separate from scoped windows on the same query', async () => {
  await saveOrdinary();
  const h = client();
  openAt(h, { key: older.key });
  windowAt(h, pivot); // A scoped request cancels the queued ordinary cache paint.
  allow(h);
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(h)).toEqual([]);

  h.rows(scoped);
  h.emit(scopedPatch);
  expect(painted(h).at(-1)?.rows).toEqual(scoped);
  expect(h.messages.at(-1)).toEqual(scopedPatch);
  await vi.advanceTimersByTimeAsync(201);
  windowAt(h, 'top');
  h.rows(scoped); // An in-flight scoped response must not replace the ordinary head.
  await vi.advanceTimersByTimeAsync(201);
  h.transport.close();

  for (const anchor of ordinaryAnchors) {
    expect(readPublicSnapshot(identity, anchor)?.rows).toEqual(ordinary);
    const cold = client();
    openAt(cold, anchor);
    await vi.advanceTimersByTimeAsync(0);
    expect(painted(cold).map((message) => message.rows)).toEqual([ordinary]);
    expect(painted(cold)[0]?.rows.some((row) => Object.hasOwn(row, 'readingAt'))).toBe(false);
  }
});
