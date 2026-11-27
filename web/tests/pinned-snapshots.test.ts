import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Anchor, NoteRow, Query } from '../src/engine/protocol.ts';
import {
  readPublicSnapshot,
  snapshotIdentity,
  snapshotSafe,
  writePublicSnapshot,
} from '../src/engine/public-snapshot-store.ts';
import { harness, note } from './public-snapshots-support.ts';

const query: Query = { source: 'profile', pubkey: 'a'.repeat(64), show: 'posts' };
const identity = snapshotIdentity(query, 'en', true);
const newest: NoteRow = {
  ...note('2'.repeat(64)),
  at: 20_000,
  mine: { ...note().mine, own: true, pinned: true },
};
const oldest = { ...note('1'.repeat(64)), at: 10_000 };
const ordinary = [newest, oldest];
const scoped = [
  { ...oldest, pinned: true },
  { ...newest, pinned: true },
];
const anchors: Anchor[] = ['top', { key: oldest.key }];
type Harness = ReturnType<typeof harness>;
const clients: Harness[] = [];
const client = () => {
  const h = harness();
  clients.push(h);
  return h;
};
const at = (h: Harness, anchor: Anchor, source = query) => {
  h.transport.post({ t: 'open', sub: 'one', query: source });
  h.transport.post({ t: 'window', sub: 'one', anchor, before: 0, after: 60 });
};
const allow = (h: Harness) => h.emit({ t: 'cache.policy', sub: 'one', allow: true });
const painted = (h: Harness) => h.messages.filter((message) => message.t === 'rows');
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  for (const h of clients.splice(0)) h.transport.close();
  localStorage.clear();
  vi.useRealTimers();
});

it('captures ordinary account membership and replays the chronological profile anchor', async () => {
  const first = client();
  at(first, 'top');
  allow(first);
  first.rows(ordinary);
  first.transport.post({ t: 'reading', sub: 'one', key: oldest.key });
  await vi.advanceTimersByTimeAsync(201);
  first.transport.close();
  expect(snapshotSafe(newest)).toBe(true);
  expect(readPublicSnapshot(identity, { key: oldest.key })?.anchor).toBe(newest.key);
  for (const anchor of anchors) {
    const cold = client();
    at(cold, anchor);
    await vi.advanceTimersByTimeAsync(0);
    expect(painted(cold).at(-1)?.rows).toEqual(ordinary);
    expect(painted(cold).at(-1)?.rows[0]).toMatchObject({ mine: { pinned: true } });
    expect(
      painted(cold)
        .at(-1)
        ?.rows.some((row) => 'pinned' in row),
    ).toBe(false);
  }
});

it('rejects pinned placement in both snapshot windows without replacing ordinary same-query order', () => {
  for (const top of [false, true]) {
    const saved = { rows: ordinary, anchor: oldest.key, atTop: false, atBottom: false };
    writePublicSnapshot(identity, top, saved);
    expect(scoped.every(snapshotSafe)).toBe(false);
    writePublicSnapshot(identity, top, {
      rows: scoped,
      anchor: oldest.key,
      atTop: true,
      atBottom: true,
    });
    expect(readPublicSnapshot(identity, top ? 'top' : { key: oldest.key })).toEqual(saved);
  }
});

it('does not capture or replay finite pins even when public cache permission is granted', async () => {
  const pins: Query = { source: 'pins', pubkey: query.pubkey };
  const h = client();
  at(h, 'top', pins);
  allow(h);
  h.rows(scoped);
  await vi.advanceTimersByTimeAsync(201);
  h.transport.close();
  const key = snapshotIdentity(pins, 'en', true);
  for (const anchor of anchors) {
    expect(readPublicSnapshot(key, anchor)).toBeUndefined();
    const cold = client();
    at(cold, anchor, pins);
    await vi.advanceTimersByTimeAsync(0);
    expect(painted(cold)).toEqual([]);
    expect(cold.post.mock.calls.some(([message]) => message.t === 'cache.hold')).toBe(false);
  }
});

it.each(['read', 'top'])('rejects obsolete serialized pin placement in the %s slot', (slot) => {
  const body = JSON.stringify({
    rows: scoped,
    anchor: oldest.key,
    atTop: true,
    atBottom: true,
  });
  let check = 2166136261;
  for (let i = 0; i < body.length; i++) check = Math.imul(check ^ body.charCodeAt(i), 16777619);
  localStorage.setItem(
    `lkjstr:public-view:1:${slot}:${identity}`,
    JSON.stringify({
      version: 2,
      seen: Date.now(),
      body,
      check: check >>> 0,
    }),
  );
  expect(
    readPublicSnapshot(identity, slot === 'top' ? 'top' : { key: oldest.key }),
  ).toBeUndefined();
});

it('replaces remembered membership with a fresh unpin in displayed and durable rows', async () => {
  const first = client();
  at(first, 'top');
  allow(first);
  first.rows(ordinary);
  first.transport.close();

  const warm = client();
  at(warm, 'top');
  await vi.advanceTimersByTimeAsync(0);
  expect(painted(warm).at(-1)?.rows[0]).toMatchObject({ mine: { pinned: true } });
  allow(warm);
  const fresh = { ...newest, mine: { ...newest.mine, pinned: false } };
  warm.rows([fresh, oldest]);
  expect(painted(warm).at(-1)?.rows[0]).toMatchObject({ mine: { pinned: false } });
  await vi.advanceTimersByTimeAsync(201);
  warm.transport.close();
  expect(readPublicSnapshot(identity, 'top')?.rows[0]).toMatchObject({
    key: newest.key,
    mine: { pinned: false },
  });
});
