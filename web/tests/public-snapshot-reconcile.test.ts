import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NoteRow, ProfileRow } from '../src/engine/protocol.ts';
import {
  heldPublicReferences,
  invalidatePublicRow,
} from '../src/engine/public-snapshot-reconcile.ts';
import {
  readPublicSnapshot,
  snapshotIdentity,
  writePublicSnapshot,
} from '../src/engine/public-snapshot-store.ts';
import { knownPerson, learnPerson } from '../src/shared/people.ts';
import { harness, note, query, savePublic } from './public-snapshots-support.ts';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

it('announces held identities without admitting cached bodies to the engine', async () => {
  await savePublic();
  const h = harness();
  h.open();
  await vi.advanceTimersByTimeAsync(0);
  const held = h.post.mock.calls.map(([m]) => m).find((m) => m.t === 'cache.hold');
  expect(held).toEqual({
    t: 'cache.hold',
    sub: 'one',
    rows: [
      {
        key: note().key,
        id: note().id,
        profiles: [{ pubkey: note().author.pubkey, id: note().author.profileId }],
        quotes: [],
      },
    ],
  });
  expect(JSON.stringify(held)).not.toContain('A verified public note');
  h.transport.close();
});

it('a deletion known before Open removes the held row and both durable windows', async () => {
  await savePublic();
  const h = harness();
  h.open();
  await vi.advanceTimersByTimeAsync(0);
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  h.rows([]);
  h.emit({
    t: 'cache.reconcile',
    sub: 'one',
    removedKeys: [note().key],
    invalidProfileIds: [],
    removedQuoteIds: [],
  });
  expect(
    h.messages.some(
      (m) => m.t === 'patch' && m.ops.some((op) => op.op === 'remove' && op.key === note().key),
    ),
  ).toBe(true);
  const identity = snapshotIdentity(query, 'en', true);
  expect(readPublicSnapshot(identity, 'top')).toBeUndefined();
  expect(readPublicSnapshot(identity, { key: note().key })).toBeUndefined();
  h.transport.close();
});

it('unknown removals and empty relay completion do not delete a held screen', async () => {
  await savePublic();
  const h = harness();
  h.open();
  await vi.advanceTimersByTimeAsync(0);
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  h.rows([]);
  h.emit({ t: 'state', sub: 'one', state: { phase: 'done', relaysAsked: 1, relaysAnswered: 1 } });
  h.emit({
    t: 'cache.reconcile',
    sub: 'one',
    removedKeys: ['9'.repeat(64)],
    invalidProfileIds: ['8'.repeat(64)],
    removedQuoteIds: ['7'.repeat(64)],
  });
  expect(readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')?.rows).toEqual([note()]);
  expect(
    h.messages
      .filter((m) => m.t === 'patch')
      .flatMap((m) => m.ops)
      .some((op) => op.op === 'remove'),
  ).toBe(false);
  h.transport.close();
});

it('positive profile and quote deletion survives incomplete hydration and late rows', async () => {
  const value: NoteRow = {
    ...note(),
    quotes: [
      {
        state: 'ok',
        id: '2'.repeat(64),
        author: note().author,
        at: 1,
        segments: [{ k: 'text', text: 'Previously read quote' }],
        media: [],
      },
    ],
  };
  await savePublic([value]);
  const h = harness();
  h.open();
  await vi.advanceTimersByTimeAsync(0);
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  h.rows([]);
  h.emit({
    t: 'cache.reconcile',
    sub: 'one',
    removedKeys: [],
    invalidProfileIds: [value.author.profileId!],
    removedQuoteIds: [value.quotes[0]!.id],
  });
  const saved = readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')?.rows[0];
  expect(saved).toMatchObject({
    author: { pubkey: value.author.pubkey, name: '' },
    quotes: [{ state: 'deleted', id: value.quotes[0]!.id }],
  });
  expect(saved?.kind === 'note' && saved.author.picture).toBeUndefined();
  h.rows([value]);
  const rows = h.messages.filter((m) => m.t === 'rows').at(-1);
  expect(rows?.rows[0]).toMatchObject({ author: { name: '' }, quotes: [{ state: 'deleted' }] });
  h.emit({ t: 'patch', sub: 'one', ops: [{ op: 'update', row: value }] });
  const last = h.messages.filter((m) => m.t === 'patch').at(-1);
  expect(last?.ops[0]).toMatchObject({ op: 'update', row: { author: { name: '' } } });
  h.transport.close();
});

it('the original reference ledger still corrects an older saved window after fresh metadata arrives', async () => {
  await savePublic();
  const identity = snapshotIdentity(query, 'en', true);
  const read = { rows: [note()], anchor: note().key, atTop: false, atBottom: false };
  writePublicSnapshot(identity, false, read);
  const h = harness();
  h.open();
  await vi.advanceTimersByTimeAsync(0);
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  const fresh = {
    ...note(),
    author: { ...note().author, profileId: 'd'.repeat(64), name: 'New name' },
  };
  h.rows([fresh]);
  h.emit({
    t: 'cache.reconcile',
    sub: 'one',
    removedKeys: [],
    invalidProfileIds: [note().author.profileId!],
    removedQuoteIds: [],
  });
  const saved = readPublicSnapshot(identity, { key: note().key })?.rows[0];
  expect(saved).toMatchObject({ author: { name: '' } });
  expect(h.messages.filter((m) => m.t === 'rows').at(-1)?.rows[0]).toMatchObject({
    author: { name: 'New name' },
  });
  h.transport.close();
});

it('clears only deleted profile content and preserves independent follow/count evidence', () => {
  const row: ProfileRow = {
    kind: 'profile',
    key: 'profile',
    author: note().author,
    about: [{ k: 'text', text: 'Old biography' }],
    banner: 'https://images.test/banner',
    website: 'https://example.test/',
    relays: ['relay.test'],
    followed: true,
    followsYou: false,
    self: false,
    muted: false,
    partial: false,
    followers: 3,
  };
  const result = invalidatePublicRow(row, {
    keys: new Set(),
    quotes: new Set(),
    profiles: new Set([note().author.profileId!]),
  });
  expect(result).toMatchObject({
    author: { name: '' },
    about: [],
    relays: ['relay.test'],
    followers: 3,
    followed: true,
  });
  expect(result.kind === 'profile' && result.banner).toBeUndefined();
});

it('collects embedded actors without treating notification targets as deleted notification rows', () => {
  const row = {
    kind: 'notification' as const,
    key: 'notification',
    type: 'reaction' as const,
    actors: [note().author],
    others: 0,
    at: 1,
    unread: true,
    target: { id: note().id, excerpt: 'Public target', media: 0 },
  };
  expect(heldPublicReferences([row])[0]).toEqual({
    key: row.key,
    profiles: [{ pubkey: note().author.pubkey, id: note().author.profileId }],
    quotes: [{ id: note().id }],
  });
});

it('moves the pinned want to the surviving held anchor after positive removal', async () => {
  const second = note('4'.repeat(64));
  await savePublic([note(), second]);
  const h = harness();
  h.open();
  await vi.advanceTimersByTimeAsync(0);
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  h.rows([]);
  h.emit({
    t: 'cache.reconcile',
    sub: 'one',
    removedKeys: [note().key],
    invalidProfileIds: [],
    removedQuoteIds: [],
  });
  expect(
    h.post.mock.calls
      .map(([m]) => m)
      .filter((m) => m.t === 'window')
      .at(-1),
  ).toMatchObject({ anchor: { key: second.key } });
  expect(readPublicSnapshot(snapshotIdentity(query, 'en', true), 'top')?.anchor).toBe(second.key);
  h.transport.close();
});

it('clears matching remembered faces before a metadata-less fallback can restore them', async () => {
  await savePublic();
  learnPerson(note().author);
  const h = harness();
  h.open();
  await vi.advanceTimersByTimeAsync(0);
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  h.emit({
    t: 'cache.reconcile',
    sub: 'one',
    removedKeys: [],
    invalidProfileIds: [note().author.profileId!],
    removedQuoteIds: [],
  });
  expect(knownPerson(note().author.pubkey)).toMatchObject({ name: '' });
  expect(knownPerson(note().author.pubkey)?.picture).toBeUndefined();
  const newer = { ...note().author, profileId: 'e'.repeat(64), name: 'Later profile' };
  learnPerson(newer);
  h.emit({
    t: 'cache.reconcile',
    sub: 'one',
    removedKeys: [],
    invalidProfileIds: [note().author.profileId!],
    removedQuoteIds: [],
  });
  expect(knownPerson(newer.pubkey)?.name).toBe('Later profile');
  h.transport.close();
});
