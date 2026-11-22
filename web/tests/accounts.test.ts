import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { SELF } from '../src/engine/mock/people.ts';
import type { Action, Author, FromEngine, ProfileRow } from '../src/engine/protocol.ts';
import { rememberedFace, rememberFace } from '../src/shared/face.ts';
import { nameText, plainName, shortNpub, unnamed } from '../src/views/parts.ts';
import { panes } from '../src/wm/layout.ts';
import { familyOf, presetOf } from '../src/wm/presets.ts';

const HEX = 'ab'.repeat(32);
const NPUB = `npub1${'q'.repeat(58)}`;
const who = (name: string): Author => ({ pubkey: HEX, npub: NPUB, name });

describe('a name that has not arrived', () => {
  it('is a short npub, whatever the engine sent in its place', () => {
    for (const name of ['', HEX, NPUB]) {
      expect(unnamed(who(name))).toBe(true);
      expect(plainName(who(name))).toBe('npub1qqqqq…qqqq');
    }
    expect(shortNpub({ pubkey: HEX, npub: '', name: '' })).toBe('abababab…abab');
    expect(plainName(who('葵 :neko:'))).toBe('葵');
    expect(nameText(HEX)).toBe('abababab…abab');
    expect(nameText('Lena')).toBe('Lena');
  });
});

describe('the remembered face', () => {
  it('comes back only for the same account, and only as public profile data', () => {
    rememberFace({
      author: { ...who('葵'), picture: 'https://x.example/a.png' },
      signer: 'none',
      unread: 4,
    });
    expect(rememberedFace(HEX)[0]).toMatchObject({
      signer: 'none',
      unread: 0,
      author: { name: '葵' },
    });
    expect(rememberedFace('cd'.repeat(32))).toEqual([]);
    localStorage.setItem('lkjstr:account:face', '{"author":{"pubkey":"x"},"signer":"root"}');
    expect(rememberedFace('x')).toEqual([]);
    rememberFace(undefined);
    expect(rememberedFace(HEX)).toEqual([]);
  });
});

describe('the layout families', () => {
  it('both start from one arrangement; what is in front fits who reads', () => {
    const fronts = (signedIn: boolean): string[] =>
      panes(presetOf(1, 1440, familyOf(signedIn))).map((p) => p.active);
    expect(fronts(false)).toEqual(['their-home~lkjsxc', 'docs', 'compose', 'account']);
    expect(fronts(true)).toEqual(['home', 'docs', 'compose', 'account']);
  });
});

describe('mock accounts', () => {
  let out: FromEngine[] = [];
  let engine: MockEngine;
  let req = 0;
  const of = <T extends FromEngine['t']>(t: T): Extract<FromEngine, { t: T }>[] =>
    out.filter((m): m is Extract<FromEngine, { t: T }> => m.t === t);
  const act = (action: Action): Extract<FromEngine, { t: 'result' }> | undefined => {
    const id = `r${++req}`;
    engine.handle({ t: 'act', req: id, action });
    vi.advanceTimersByTime(4000);
    return of('result').find((r) => r.req === id);
  };
  const state = () => of('accounts').at(-1);
  beforeEach(() => {
    vi.useFakeTimers();
    out = [];
    engine = createMockEngine((m) => out.push(structuredClone(m)));
    engine.handle({
      t: 'configure',
      config: {
        language: 'en',
        heuristics: true,
        prefetch: true,
        mock: { live: false, accounts: 'none' },
      },
    });
  });
  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
  });

  it('a first visit: nobody is signed in and a list of one’s own is empty at once', () => {
    expect(state()).toMatchObject({ accounts: [] });
    expect(state()?.active).toBeUndefined();
    engine.handle({ t: 'open', sub: 'h', query: { source: 'home' } });
    engine.handle({ t: 'window', sub: 'h', anchor: 'top', before: 0, after: 30 });
    expect(of('rows').at(-1)?.rows).toEqual([]);
    expect(of('state').at(-1)?.state.phase).toBe('done');
    expect(act({ a: 'bookmark', as: '', id: 'x', on: true })?.error?.code).toBe('signed-out');
  });

  it('a created account can show its key; nothing else can', () => {
    expect(act({ a: 'account.add', how: 'create' })?.ok).toBe(true);
    const me = state()?.active ?? '';
    expect(state()?.accounts[0]).toMatchObject({ signer: 'local', author: { name: me } });
    expect(act({ a: 'account.key', pubkey: me })?.key).toMatch(/^nsec1/);
    expect(act({ a: 'account.add', how: 'key', key: NPUB })?.ok).toBe(true);
    const reader = state()?.active ?? '';
    expect(act({ a: 'account.key', pubkey: reader })).toMatchObject({ ok: false });
    expect(act({ a: 'account.key', pubkey: reader })?.key).toBeUndefined();
  });

  it('a public key signs in read-only and every write is refused as such', () => {
    expect(act({ a: 'account.add', how: 'key', key: SELF.author.npub })?.ok).toBe(true);
    expect(state()).toMatchObject({ active: SELF.author.pubkey, accounts: [{ signer: 'none' }] });
    const post: Action = {
      a: 'publish',
      as: SELF.author.pubkey,
      what: { k: 'note', draft: { text: 'x' } },
    };
    expect(act(post)?.error?.code).toBe('read-only');
    expect(act({ a: 'account.add', how: 'key', key: 'hunter2' })?.error?.code).toBe('rejected');
    expect(act({ a: 'account.remove', pubkey: SELF.author.pubkey })?.ok).toBe(true);
    expect(state()?.active).toBeUndefined();
  });

  it('the extension is asked for its key on the main thread, and may refuse', () => {
    engine.handle({ t: 'act', req: 'x1', action: { a: 'account.add', how: 'extension' } });
    expect(of('getPublicKey').at(-1)?.req).toBe('x1');
    engine.handle({ t: 'publicKey', req: 'x1', error: 'signer-refused' });
    expect(of('result').at(-1)?.error?.code).toBe('signer-refused');
    engine.handle({ t: 'act', req: 'x2', action: { a: 'account.add', how: 'extension' } });
    engine.handle({ t: 'publicKey', req: 'x2', pubkey: HEX });
    expect(state()).toMatchObject({ active: HEX, accounts: [{ signer: 'extension' }] });
  });

  it('a profile nobody has metadata for carries no counts', () => {
    engine.handle({ t: 'open', sub: 'p', query: { source: 'profile', pubkey: HEX } });
    engine.handle({ t: 'window', sub: 'p', anchor: 'top', before: 0, after: 5 });
    const row = of('rows').at(-1)?.rows[0] as ProfileRow;
    expect(row.author.name).toBe(HEX);
    expect(row.following).toBeUndefined();
    expect(row.followers).toBeUndefined();
  });
});
