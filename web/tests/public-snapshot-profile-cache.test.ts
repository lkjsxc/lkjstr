import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ProfileRow, Query } from '../src/engine/protocol.ts';
import { capturePublicWindow } from '../src/engine/public-snapshot-model.ts';
import {
  readPublicSnapshot,
  snapshotIdentity,
  writePublicSnapshot,
} from '../src/engine/public-snapshot-store.ts';
import { knownPerson, learnRows } from '../src/shared/people.ts';
import { harness, note } from './public-snapshots-support.ts';

const header: ProfileRow = {
  kind: 'profile',
  key: `profile:${note().author.pubkey}`,
  author: note().author,
  about: [{ k: 'text', text: 'Cached biography' }],
  relays: ['relay.test'],
  partial: true,
  followed: false,
  followsYou: false,
  self: false,
  muted: false,
};
const profile: Query = { source: 'profile', pubkey: header.author.pubkey, show: 'posts' };

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

it('uses the same identity for default and explicit Posts queries, but not posts-only', () => {
  const key = (q: Query) => snapshotIdentity(q, 'en', true);
  expect(key({ ...profile, show: undefined })).toEqual(key(profile));
  expect(key({ ...profile, reposts: true })).not.toEqual(key(profile));
  expect(key({ ...profile, reposts: false })).not.toEqual(key(profile));
  expect(key({ ...profile, show: 'replies' })).not.toEqual(key(profile));
});

it('retains the profile header in a bounded deep reading snapshot', () => {
  const notes = Array.from({ length: 100 }, (_, i) => note(String(i).padStart(64, '0')));
  const snapshot = capturePublicWindow([header, ...notes], notes[30]?.key, false, true);
  expect(snapshot?.rows[0]).toEqual(header);
  expect(snapshot?.rows).toHaveLength(64);
  expect(snapshot?.rows.some((r) => r.key === notes[30]?.key)).toBe(true);
  expect(snapshot?.anchor).not.toBe(header.key);
  expect(snapshot?.atBottom).toBe(false);
});

it('keeps atTop when the reading slice starts immediately after the prepended header', () => {
  const notes = Array.from({ length: 100 }, (_, i) => note(String(i).padStart(64, '0')));
  const rows = [header, ...notes];
  const contiguous = capturePublicWindow(rows, notes[8]?.key, true, false);
  expect(contiguous?.rows).toEqual(rows.slice(0, 64));
  expect(contiguous?.atTop).toBe(true);
  expect(capturePublicWindow(rows, notes[9]?.key, true, false)?.atTop).toBe(false);
  expect(capturePublicWindow(rows, notes[8]?.key, false, false)?.atTop).toBe(false);
});

it('replays a header-only cached profile at top and releases it when notes arrive', async () => {
  writePublicSnapshot(snapshotIdentity(profile, 'en', true), true, {
    rows: [header],
    anchor: header.key,
    atTop: true,
    atBottom: false,
  });
  const h = harness();
  h.open(profile);
  await vi.advanceTimersByTimeAsync(0);
  expect(h.messages.at(-1)).toMatchObject({ t: 'rows', rows: [header] });
  expect(h.post.mock.calls.find(([m]) => m.t === 'window')?.[0]).toMatchObject({
    anchor: 'top',
  });
  h.emit({ t: 'cache.policy', sub: 'one', allow: true });
  h.emit({ t: 'rows', sub: 'one', rows: [header, note()], atTop: true, atBottom: false });
  expect(h.messages.at(-1)).toMatchObject({ t: 'rows', rows: [header, note()] });
  h.transport.close();
});

it('learns nested reply and known-follower authors from public rows', () => {
  const actor = { ...header.author, pubkey: 'e'.repeat(64), profileId: 'f'.repeat(64) };
  const follower = { ...header.author, pubkey: '1'.repeat(64), profileId: '2'.repeat(64) };
  learnRows([
    { ...header, knownFollowers: { actors: [follower], others: 0 } },
    { ...note(), replyTo: { id: '3'.repeat(64), author: actor, excerpt: '' } },
  ]);
  expect(knownPerson(actor.pubkey)).toEqual(actor);
  expect(knownPerson(follower.pubkey)).toEqual(follower);
});

it('reuses only the public header for an uncached kind, not the other kind notes', async () => {
  writePublicSnapshot(snapshotIdentity(profile, 'en', true), true, {
    rows: [header, note()],
    anchor: note().key,
    atTop: true,
    atBottom: false,
  });
  const h = harness();
  h.open({ ...profile, show: 'replies' });
  await vi.advanceTimersByTimeAsync(0);
  expect(h.messages.at(-1)).toMatchObject({ t: 'rows', rows: [header] });
  expect(h.post.mock.calls.find(([m]) => m.t === 'window')?.[0]).toMatchObject({ anchor: 'top' });
  h.transport.close();
  const other = harness();
  other.open({ ...profile, show: 'replies', account: 'a'.repeat(64) });
  await vi.advanceTimersByTimeAsync(0);
  expect(other.messages).toHaveLength(0);
  other.transport.close();
});

it.each([false, true])(
  'reuses a cached Replies header for explicit Posts reposts=%s',
  async (reposts) => {
    writePublicSnapshot(snapshotIdentity({ ...profile, show: 'replies' }, 'en', true), true, {
      rows: [header, note()],
      anchor: note().key,
      atTop: true,
      atBottom: false,
    });
    const h = harness();
    h.open({ ...profile, show: 'posts', reposts });
    await vi.advanceTimersByTimeAsync(0);
    expect(h.messages.at(-1)).toMatchObject({ t: 'rows', rows: [header] });
    expect(h.post.mock.calls.find(([m]) => m.t === 'window')?.[0]).toMatchObject({ anchor: 'top' });
    h.transport.close();
  },
);

const siblingCases: { label: string; saved: Query; active: Query }[] = [
  { label: 'default Posts to Replies', saved: profile, active: { ...profile, show: 'replies' } },
  {
    label: 'Replies to Posts without reposts',
    saved: { ...profile, show: 'replies' },
    active: { ...profile, show: 'posts', reposts: false },
  },
  {
    label: 'Replies to Posts with explicit reposts',
    saved: { ...profile, show: 'replies' },
    active: { ...profile, show: 'posts', reposts: true },
  },
];

it.each(siblingCases)(
  'invalidates sibling headers without deleting notes: $label',
  async (test) => {
    const saved = snapshotIdentity(test.saved, 'en', true);
    writePublicSnapshot(saved, true, {
      rows: [header, note()],
      anchor: note().key,
      atTop: true,
      atBottom: false,
    });
    const h = harness();
    h.open(test.active);
    await vi.advanceTimersByTimeAsync(0);
    h.emit({ t: 'cache.policy', sub: 'one', allow: true });
    h.emit({
      t: 'cache.reconcile',
      sub: 'one',
      removedKeys: [],
      invalidProfileIds: [header.author.profileId!],
      removedQuoteIds: [],
    });
    const rows = readPublicSnapshot(saved, 'top')?.rows;
    expect(rows?.length).toBe(2);
    expect(rows?.[0]).toMatchObject({ kind: 'profile', author: { name: '' }, about: [] });
    expect(rows?.[1]).toMatchObject({ kind: 'note', key: note().key, author: { name: '' } });
    const savedHeader = rows?.[0];
    expect(savedHeader?.kind === 'profile' && savedHeader.author.profileId).toBeUndefined();
    h.transport.close();

    const third = harness();
    third.open({ ...profile, show: 'media' });
    await vi.advanceTimersByTimeAsync(0);
    expect(third.messages).toHaveLength(0);
    third.transport.close();
  },
);

it.each(siblingCases)(
  'denied policy removes sibling snapshots before replay: $label',
  async (test) => {
    const saved = snapshotIdentity(test.saved, 'en', true);
    writePublicSnapshot(saved, true, {
      rows: [header, note()],
      anchor: note().key,
      atTop: true,
      atBottom: false,
    });
    const h = harness();
    h.open(test.active);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.messages.at(-1)).toMatchObject({ t: 'rows', rows: [header] });
    h.emit({ t: 'cache.policy', sub: 'one', allow: false });
    expect(readPublicSnapshot(saved, 'top')).toBeUndefined();
    h.transport.close();
  },
);
