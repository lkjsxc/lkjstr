import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FromEngine } from '../src/engine/protocol.ts';
import { readPublicSnapshot, snapshotIdentity } from '../src/engine/public-snapshot-store.ts';
import { harness, note, query, savePublic } from './public-snapshots-support.ts';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

it('paints saved public names and pictures before any Worker response and sends a held anchor', async () => {
  await savePublic();
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  const rows = next.messages.find((message) => message.t === 'rows');
  expect(rows?.t === 'rows' && rows.rows).toEqual([note()]);
  expect(next.post.mock.calls.find(([message]) => message.t === 'window')?.[0]).toMatchObject({
    anchor: { key: note().key },
    before: 0,
  });
  expect(next.messages).toContainEqual({
    t: 'state',
    sub: 'one',
    state: { phase: 'cache', relaysAsked: 0, relaysAnswered: 0 },
  });
  next.transport.close();
});

it('does not flash an empty or partially loaded bootstrap over the retained screen', async () => {
  const second = note('2'.repeat(64));
  await savePublic([note(), second]);
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  next.rows([]);
  next.rows([note()]);
  expect(next.messages.filter((message) => message.t === 'rows')).toHaveLength(1);
  next.rows([note(), second]);
  expect(next.messages.filter((message) => message.t === 'rows')).toHaveLength(2);
  next.transport.close();
});

it('never persists a private projection, message body or exported key', async () => {
  const next = harness();
  next.open();
  next.emit({ t: 'cache.policy', sub: 'one', allow: false });
  next.rows([{ ...note(), segments: [{ k: 'text', text: 'private-list-derived-value' }] }]);
  next.emit({
    t: 'dm',
    sub: 'dm',
    snapshot: { body: 'private-message-value' },
  } as unknown as FromEngine);
  next.emit({ t: 'result', req: 'key', ok: true, key: 'private-key-fixture' });
  await vi.advanceTimersByTimeAsync(300);
  expect(localStorage.length).toBe(0);
  next.transport.close();
});

it('revokes saved windows and cannot promote retained private rows after permission returns', async () => {
  await savePublic();
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  next.emit({ t: 'cache.policy', sub: 'one', allow: false });
  expect(localStorage.length).toBe(0);
  next.rows([{ ...note(), segments: [{ k: 'text', text: 'private-value' }] }]);
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  await vi.advanceTimersByTimeAsync(300);
  next.transport.close();
  expect(localStorage.length).toBe(0);
});

it('partitions account and filter identities and cancels closed-view replay', async () => {
  await savePublic();
  const other = harness();
  other.open({ ...query, account: 'd'.repeat(64) });
  await vi.advanceTimersByTimeAsync(0);
  expect(other.messages).toHaveLength(0);
  other.transport.close();
  const cancelled = harness();
  cancelled.open();
  cancelled.transport.post({ t: 'close', sub: 'one' });
  await vi.advanceTimersByTimeAsync(0);
  expect(cancelled.messages).toHaveLength(0);
  cancelled.transport.close();
});

it('keeps later profile hydration in the top snapshot after its anchor is held', async () => {
  const first = harness();
  first.open();
  first.emit({ t: 'cache.policy', sub: 'one', allow: true });
  first.rows([
    { ...note(), author: { ...note().author, name: '', profileId: undefined, picture: undefined } },
  ]);
  first.transport.post({
    t: 'window',
    sub: 'one',
    anchor: { key: note().key },
    before: 0,
    after: 60,
  });
  first.emit({ t: 'patch', sub: 'one', ops: [{ op: 'update', row: note() }] });
  await vi.advanceTimersByTimeAsync(201);
  const saved = readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top');
  expect(saved?.rows).toEqual([note()]);
  first.transport.close();
});

it('explicit navigation releases a held snapshot and positive removal reaches the reader', async () => {
  await savePublic();
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  next.transport.post({ t: 'window', sub: 'one', anchor: 'top', before: 0, after: 60 });
  next.rows([note('3'.repeat(64))]);
  const rows = next.messages.filter((message) => message.t === 'rows');
  expect(rows.at(-1)?.t === 'rows' && rows.at(-1)?.rows[0]?.key).toBe('3'.repeat(64));
  next.emit({ t: 'patch', sub: 'one', ops: [{ op: 'remove', key: '3'.repeat(64) }] });
  expect(next.messages.at(-1)).toMatchObject({
    t: 'patch',
    ops: [{ op: 'remove', key: '3'.repeat(64) }],
  });
  next.transport.close();
});

it('rejects a damaged persisted record without clearing unrelated device state', async () => {
  await savePublic();
  localStorage.setItem('lkjstr:settings', '{"theme":"dark"}');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('lkjstr:public-view:'))
      localStorage.setItem(key, '{"version":1,"body":"broken","check":3}');
  }
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  expect(next.messages).toHaveLength(0);
  expect(localStorage.getItem('lkjstr:settings')).toBe('{"theme":"dark"}');
  next.transport.close();
});

it('does not prepend or interleave a new Open response before its pinned Window response', async () => {
  const second = note('2'.repeat(64));
  await savePublic([note(), second]);
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  next.rows([note('9'.repeat(64)), note(), note('8'.repeat(64)), second, note('3'.repeat(64))]);
  expect(next.messages.filter((message) => message.t === 'rows')).toHaveLength(1);
  next.rows([note(), note('8'.repeat(64)), second, note('3'.repeat(64))]);
  const result = next.messages.filter((message) => message.t === 'rows').at(-1);
  expect(result?.t === 'rows' && result.rows.map((row) => row.key)).toEqual([
    note().key,
    second.key,
    '3'.repeat(64),
  ]);
  next.transport.close();
});

it('never relabels old row models with a changed rendering configuration', async () => {
  const next = harness();
  next.open();
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  next.rows([note()]);
  next.transport.post({
    t: 'configure',
    config: { language: 'ja', linkPreviews: false, heuristics: true, prefetch: true },
  });
  next.transport.post({ t: 'reading', sub: 'one', key: note().key });
  next.rows([note()]);
  await vi.advanceTimersByTimeAsync(201);
  expect(readPublicSnapshot(snapshotIdentity(query, 'ja', false), 'top')).toBeUndefined();
  next.transport.close();
});

it('keeps a stored public event through offline completion and relay EOSE until explicit removal', async () => {
  await savePublic();
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  next.rows([]);
  next.emit({
    t: 'state',
    sub: 'one',
    state: { phase: 'done', relaysAsked: 0, relaysAnswered: 0 },
  });
  expect(next.messages.filter((message) => message.t === 'rows')).toHaveLength(1);
  next.emit({
    t: 'state',
    sub: 'one',
    state: { phase: 'done', relaysAsked: 1, relaysAnswered: 1 },
  });
  await vi.advanceTimersByTimeAsync(201);
  expect(next.messages.filter((message) => message.t === 'rows')).toHaveLength(1);
  expect(readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')?.rows).toEqual([note()]);
  next.emit({ t: 'patch', sub: 'one', ops: [{ op: 'remove', key: note().key }] });
  await vi.advanceTimersByTimeAsync(201);
  expect(readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')).toBeUndefined();
  next.transport.close();
});
