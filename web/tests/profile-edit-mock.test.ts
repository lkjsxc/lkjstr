import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { SELF, saveProfile } from '../src/engine/mock/people.ts';
import { applyOps } from '../src/engine/ops.ts';
import type { FromEngine, NoteRow, ProfileEdit, ProfileRow, Row } from '../src/engine/protocol.ts';

const NOW = Date.UTC(2026, 10, 25, 3, 0, 0);
let out: FromEngine[] = [];
let engine: MockEngine;
let original: ProfileEdit;
const rowsOf = (sub: string): Row[] => {
  let rows: Row[] = [];
  for (const m of out) {
    if (m.t === 'rows' && m.sub === sub) rows = [...m.rows];
    if (m.t === 'patch' && m.sub === sub) rows = applyOps(rows, m.ops);
  }
  return rows;
};
const profile = (sub: string) => rowsOf(sub).find((r): r is ProfileRow => r.kind === 'profile');
const result = (req: string) => out.find((m) => m.t === 'result' && m.req === req);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  out = [];
  engine = createMockEngine((m) => out.push(structuredClone(m)));
  engine.handle({
    t: 'configure',
    config: { language: 'en', heuristics: true, prefetch: true, mock: { live: false } },
  });
  vi.advanceTimersByTime(10);
  const open = (sub: string, source: 'profile' | 'home') => {
    engine.handle({
      t: 'open',
      sub,
      query: { source, pubkey: SELF.author.pubkey, account: SELF.author.pubkey },
    });
    engine.handle({ t: 'window', sub, anchor: 'top', before: 0, after: 40 });
  };
  open('me', 'profile');
  open('home', 'home');
  original = profile('me')!.edit!;
});
afterEach(() => {
  saveProfile(SELF, original); // the mock's people are shared by every engine of this file
  engine.dispose();
  vi.useRealTimers();
});

it('gives the reader’s own row its published fields, and no one else’s', () => {
  expect(original).toMatchObject({ name: '木漏れ日', nip05: 'komorebi@example.jp' });
  expect(original.about).toContain('静かなタイムライン');
  engine.handle({
    t: 'open',
    sub: 'aoi',
    query: { source: 'profile', ref: 'aoi', account: SELF.author.pubkey },
  });
  engine.handle({ t: 'window', sub: 'aoi', anchor: 'top', before: 0, after: 5 });
  expect(profile('aoi')?.self).toBe(false);
  expect(profile('aoi')?.edit).toBeUndefined();
});

it('saves the profile: the header, own notes and the account show it', () => {
  const edit: ProfileEdit = {
    name: 'Komorebi',
    about: 'New about.',
    picture: 'https://media.example.jp/face.png',
    nip05: '_@example.jp',
    website: 'https://komorebi.example',
  };
  engine.handle({
    t: 'act',
    req: 'save',
    action: { a: 'profile.save', as: SELF.author.pubkey, profile: edit },
  });
  vi.advanceTimersByTime(3000);
  expect(result('save')).toMatchObject({ ok: true });
  const p = profile('me')!;
  expect(p.author).toMatchObject({
    name: 'Komorebi',
    picture: 'https://media.example.jp/face.png',
    nip05: 'example.jp',
    verified: false,
  });
  expect(p.about).toEqual([{ k: 'text', text: 'New about.' }]);
  expect(p.banner).toBeUndefined();
  expect(p.website).toBe('https://komorebi.example');
  expect(p.lud16).toBeUndefined();
  expect(p.edit).toMatchObject({ ...edit, nip05: 'example.jp', banner: undefined });
  const own = rowsOf('home').find(
    (r): r is NoteRow => r.kind === 'note' && r.author.pubkey === SELF.author.pubkey,
  );
  expect(own?.author.name).toBe('Komorebi');
  const accounts = out.filter((m) => m.t === 'accounts').at(-1);
  expect(accounts?.t === 'accounts' && accounts.accounts[0]?.author.name).toBe('Komorebi');
});

it('refuses a save the relays refuse, leaving the profile as it was', () => {
  engine.handle({
    t: 'act',
    req: 'spam',
    action: {
      a: 'profile.save',
      as: SELF.author.pubkey,
      profile: { ...original, about: 'free airdrop' },
    },
  });
  vi.advanceTimersByTime(3000);
  expect(result('spam')).toMatchObject({ ok: false, error: { code: 'rejected' } });
  expect(profile('me')?.edit).toEqual(original);
});
