import { expect, it } from 'vitest';
import type { NoteRow, ProfileRow, Query } from '../src/engine/protocol.ts';
import { mergePublicRow } from '../src/engine/public-snapshot-model.ts';
import { forgetPublicSnapshot, snapshotIdentity } from '../src/engine/public-snapshot-store.ts';
import { row as profile } from './profile-edit-fixture.ts';
import { harness, note } from './public-snapshots-support.ts';

it('retains complete quote names and link cards through incomplete hydration', () => {
  const value = note();
  const old: NoteRow = {
    ...value,
    quotes: [
      {
        state: 'ok',
        id: 'quote',
        author: value.author,
        at: 1000,
        segments: [{ k: 'text', text: 'Stored quote' }],
        media: [],
      },
    ],
    previews: [
      {
        source: 'https://example.test/',
        url: 'https://example.test/',
        kind: 'page',
        title: 'Stored card',
      },
    ],
  };
  const unknown = { ...value.author, name: '', profileId: undefined, picture: undefined };
  const next: NoteRow = {
    ...old,
    quotes: [
      {
        state: 'ok',
        id: 'quote',
        author: unknown,
        at: 1000,
        segments: [{ k: 'text', text: 'Stored quote' }],
        media: [],
      },
    ],
    previews: [{ source: 'https://example.test/', url: 'https://example.test/', kind: 'loading' }],
  };
  const held = mergePublicRow(old, next);
  expect(held.kind === 'note' && held.quotes[0]).toMatchObject({
    state: 'ok',
    author: { name: value.author.name, profileId: value.author.profileId },
  });
  expect(held.kind === 'note' && held.previews).toEqual(old.previews);
  const deletion = mergePublicRow(old, { ...next, quotes: [{ state: 'deleted', id: 'quote' }] });
  expect(deletion.kind === 'note' && deletion.quotes).toEqual([{ state: 'deleted', id: 'quote' }]);
});

it('keeps a remembered profile body until a verified profile replacement arrives', () => {
  const old: ProfileRow = {
    kind: 'profile',
    key: 'profile',
    author: note().author,
    about: [{ k: 'text', text: 'Stored biography' }],
    relays: ['relay.example.test'],
    partial: false,
    followed: false,
    followsYou: false,
    self: false,
    muted: false,
    followers: 3,
  };
  const next: ProfileRow = {
    ...old,
    author: { ...old.author, profileId: undefined, name: '', picture: undefined },
    about: [],
    relays: [],
    followers: undefined,
  };
  expect(mergePublicRow(old, next)).toMatchObject({
    author: old.author,
    about: old.about,
    relays: old.relays,
    followers: 3,
  });
  const changed = { ...next, author: { ...next.author, profileId: 'new-profile' } };
  expect(mergePublicRow(old, changed)).toEqual(changed);
});

it('replays only the public profile display after ordinary and scoped visits to the same query', async () => {
  const { edit, ...display } = profile();
  const query: Query = {
    source: 'profile',
    pubkey: display.author.pubkey,
    account: display.author.pubkey,
  };
  const ordinary = harness();
  const scoped = harness();
  const reload = harness();
  try {
    ordinary.open(query);
    ordinary.emit({ t: 'cache.policy', sub: 'one', allow: true });
    ordinary.emit({
      t: 'rows',
      sub: 'one',
      rows: [{ ...display, edit }],
      atTop: true,
      atBottom: true,
    });
    expect(ordinary.messages.at(-1)).toMatchObject({ t: 'rows', rows: [{ edit }] });
    ordinary.transport.close();

    scoped.transport.post({ t: 'open', sub: 'one', query });
    scoped.transport.post({ t: 'window', sub: 'one', anchor: { at: 1000 }, before: 0, after: 5 });
    scoped.emit({ t: 'cache.policy', sub: 'one', allow: true });
    const updated = { ...display, edit: { name: 'Revised', about: 'Scoped revision' } };
    scoped.emit({ t: 'rows', sub: 'one', rows: [updated], atTop: false, atBottom: true });
    expect(scoped.messages.at(-1)).toMatchObject({ t: 'rows', rows: [updated] });
    scoped.transport.close();

    reload.open(query);
    await Promise.resolve();
    expect(
      reload.messages.filter((message) => message.t === 'rows').map((message) => message.rows),
    ).toEqual([[display]]);
  } finally {
    ordinary.transport.close();
    scoped.transport.close();
    reload.transport.close();
    forgetPublicSnapshot(snapshotIdentity(query, 'en', true));
  }
});
