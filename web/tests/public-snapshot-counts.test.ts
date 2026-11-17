import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Counts, NoteRow } from '../src/engine/protocol.ts';
import {
  type DurableCounts,
  durablePublicRows,
  mergePublicCounts,
  rememberPublicCounts,
} from '../src/engine/public-snapshot-counts.ts';
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

const withCount = (
  reactions: number,
  context: Partial<NonNullable<Counts['context']>> = {},
): NoteRow => {
  const value = note();
  const basis = value.counts.context;
  if (!basis) throw Error('the fixture requires a committed contributor context');
  return {
    ...value,
    counts: {
      ...value.counts,
      reactions,
      context: { ...basis, ...context },
    },
    reactions: [{ emoji: '+', count: reactions, mine: false }],
  };
};

it('keeps held counts through incomplete hydration regardless of the partial flag', () => {
  const old = withCount(7);
  const next = withCount(0, { restored: false, current: false });
  for (const partial of [true, false])
    expect(
      mergePublicCounts(old, { ...next, counts: { ...next.counts, partial } }).counts.reactions,
    ).toBe(7);
});

it('accepts a verified lower correction with a restored same-lineage newer generation', () => {
  const old = withCount(7);
  const next = withCount(3, { generation: '2', token: 'deletion-commit' });
  expect(mergePublicCounts(old, next)).toEqual({ counts: next.counts, reactions: next.reactions });
});

it('never orders tokens or treats a recreated lineage as newer', () => {
  const old = withCount(7, { token: 'z' });
  expect(
    mergePublicCounts(old, withCount(3, { generation: '2', token: 'a' })).counts.reactions,
  ).toBe(3);
  expect(
    mergePublicCounts(old, withCount(0, { token: 'contradictory-same-generation' })).counts
      .reactions,
  ).toBe(7);
  expect(
    mergePublicCounts(old, withCount(0, { lineage: 'new', generation: '100' })).counts.reactions,
  ).toBe(7);
});

it('compares decimal generations exactly beyond safe Number precision and rejects malformed ones', () => {
  const old = withCount(7, { generation: '9007199254740993' });
  expect(
    mergePublicCounts(old, withCount(0, { generation: '9007199254740992' })).counts.reactions,
  ).toBe(7);
  expect(
    mergePublicCounts(old, withCount(4, { generation: '9007199254740994' })).counts.reactions,
  ).toBe(4);
  for (const generation of ['01', '-1', '1e20', '18446744073709551616'])
    expect(mergePublicCounts(old, withCount(0, { generation })).counts.reactions).toBe(7);
});

it('captures the last committed basis while allowing a verified live update on screen', async () => {
  const old = withCount(7);
  await savePublic([old]);
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  next.rows([old]);
  const live = withCount(8, { current: false });
  next.emit({ t: 'patch', sub: 'one', ops: [{ op: 'update', row: live }] });
  expect(next.messages.at(-1)).toMatchObject({
    t: 'patch',
    ops: [{ row: { counts: { reactions: 8 } } }],
  });
  await vi.advanceTimersByTimeAsync(201);
  const saved = readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')?.rows[0];
  expect(saved && saved.kind === 'note' && saved.counts.reactions).toBe(7);
  const committed = withCount(8, { generation: '2', token: 'next-commit' });
  next.emit({ t: 'patch', sub: 'one', ops: [{ op: 'update', row: committed }] });
  await vi.advanceTimersByTimeAsync(201);
  const updated = readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')?.rows[0];
  expect(updated && updated.kind === 'note' && updated.counts.reactions).toBe(8);
  next.transport.close();
});

it('explicit navigation can adopt a new contributor lineage', async () => {
  await savePublic([withCount(7)]);
  const next = harness();
  next.open();
  await vi.advanceTimersByTimeAsync(0);
  next.emit({ t: 'cache.policy', sub: 'one', allow: true });
  next.rows([withCount(0, { lineage: 'new' })]);
  const held = next.messages.filter((message) => message.t === 'rows').at(-1);
  expect(held?.t === 'rows' && held.rows[0]?.kind === 'note' && held.rows[0].counts.reactions).toBe(
    7,
  );
  next.transport.post({ t: 'window', sub: 'one', anchor: 'top', before: 0, after: 60 });
  next.rows([withCount(3, { lineage: 'new', token: 'recovered' })]);
  const shown = next.messages.filter((message) => message.t === 'rows').at(-1);
  expect(
    shown?.t === 'rows' && shown.rows[0]?.kind === 'note' && shown.rows[0].counts.reactions,
  ).toBe(3);
  next.transport.close();
});

it('bounds durable count models and never regresses a committed basis', () => {
  const values: DurableCounts = new Map();
  const old = withCount(7, { generation: '2' });
  rememberPublicCounts([old], values);
  rememberPublicCounts([withCount(0)], values);
  rememberPublicCounts([withCount(0, { lineage: 'new', generation: '9' })], values);
  expect(values.get(old.id)?.counts.reactions).toBe(7);
  for (let i = 0; i < 140; i++) rememberPublicCounts([{ ...old, id: String(i) }], values);
  expect(values.size).toBe(128);
  const unknown = durablePublicRows([withCount(9, { current: false })], new Map())[0];
  expect(unknown?.kind === 'note' && unknown.counts).toMatchObject({
    partial: true,
    zapState: 'loading',
    reactions: 0,
  });
});
