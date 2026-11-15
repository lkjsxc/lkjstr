import { describe, expect, it } from 'vitest';
import { relayAddress, serverAddress } from '../src/shared/address.ts';
import { findGlyphs, isEmoji } from '../src/shared/emoji-data.ts';
import { clockOf, countText, dayOf, noteTime } from '../src/shared/format.ts';
import { both, resolveLang } from '../src/shared/i18n.ts';
import {
  KEYS,
  type KeyId,
  keyCaps,
  keyText,
  pressed,
  pressedAt,
  watchPairs,
} from '../src/shared/keys.ts';
import { keyLabel } from '../src/shared/platform.ts';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_SCHEMA } from '../src/shared/settings.ts';
import { en } from '../src/shared/strings-en.ts';
import { ja } from '../src/shared/strings-ja.ts';
import { withRecent } from '../src/views/emoji-picker.ts';
import { typesQuery } from '../src/views/feed-bar.ts';
import { reconcile } from '../src/views/lists.ts';
import { freshTab, kindOf, VIEWS } from '../src/views/registry.ts';
import { matchesWords } from '../src/wm/launcher.ts';
import * as L from '../src/wm/layout.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';
import { homePreset, presetOf } from '../src/wm/presets.ts';
import { insertAt, zoneAt } from '../src/wm/tab-drag.ts';

const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };

const SPLIT_L = 'home';
const RIGHT = { col: ['compose', 'account|notifications|settings'] };

describe('layout', () => {
  it('presets follow the window width and only name known views', () => {
    const two = { row: ['global|home', { col: ['compose', 'account|notifications|settings'] }] };
    expect(shape(homePreset(1440))).toEqual(two);
    expect(shape(homePreset(1024))).toEqual(two);
    expect(shape(homePreset(390))).toBe('global|home|compose|account|notifications|settings');
    expect(shape(presetOf(5))).toBe('new');
    const known = new Set(VIEWS.map((v) => v.id));
    expect(L.views(homePreset(1440)).filter((v) => !known.has(v))).toEqual([]);
  });
  it('a new tab is inserted right after the tab it was opened from, in the same pane', () => {
    const root = homePreset(1024);
    const p = L.paneOfView(root, 'home') as L.PaneNode;
    const next = L.moveView(root, 'thread', p.id, 'center', 2);
    expect(shape(next)).toEqual({ row: ['global|home|thread', RIGHT] });
    expect(L.paneOfView(next, 'thread')?.active).toBe('thread');
    expect(L.panes(next)).toHaveLength(3);
  });
  it('split, close and stored layouts round-trip', () => {
    const root = homePreset(1024);
    const p = L.paneOfView(root, 'home') as L.PaneNode;
    const split = L.moveView(root, 'global', p.id, 'right');
    expect(shape(split)).toEqual({ row: [SPLIT_L, 'global', RIGHT] });
    expect(shape(L.removeView(split, 'global') as L.LayoutNode)).toEqual({ row: ['home', RIGHT] });
    expect(shape(parseLayout(JSON.parse(JSON.stringify(split))) as L.LayoutNode)).toEqual(
      shape(split),
    );
    expect(parseLayout({ type: 'pane' })).toBeNull();
    expect(L.removeView(L.pane(['home']), 'home')).toBeNull();
  });
  it('drop zones and strip insertion', () => {
    const r = new DOMRect(0, 0, 400, 400);
    expect(zoneAt(r, 390, 200)).toBe('right');
    expect(zoneAt(r, 200, 200)).toBe('center');
    expect(insertAt([new DOMRect(0, 0, 100, 30), new DOMRect(100, 0, 100, 30)], 120)).toEqual([
      1, 100,
    ]);
  });
  it('tab ids', () => {
    expect(freshTab('thread', new Set(['thread', 'thread~2']))).toBe('thread~3');
    expect(kindOf('profile~7')).toBe('profile');
  });
});

describe('words', () => {
  it('both tables have the same keys, no empty text, the same placeholders', () => {
    const vars = (s: string): string =>
      [...s.matchAll(/\{(\w+)\}/g)]
        .map((m) => m[1])
        .sort()
        .join();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(ja[key], key).toBeTruthy();
      expect(vars(ja[key]), key).toBe(vars(en[key]));
    }
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });
  it('Japanese is written as Japanese (no English sentence left in it)', () => {
    const allowed = /^(English|opt\.en)$/;
    for (const [key, text] of Object.entries(ja))
      if (!allowed.test(text) && !key.startsWith('list.'))
        expect(/[぀-ヿ一-鿿]/.test(text), key).toBe(true);
  });
  it('every view and setting has its words', () => {
    for (const v of VIEWS) expect(en[v.title] && en[v.hint]).toBeTruthy();
    for (const f of SETTINGS_SCHEMA)
      expect(`set.${f.key}` in en && `set.${f.key}.d` in en, f.key).toBe(true);
  });
  it('the New tab page matches either language whatever the interface language', () => {
    const search = `${both('view.notifications')} notifications`;
    expect(matchesWords(search, '通知')).toBe(true);
    expect(matchesWords(search, 'NOTIF')).toBe(true);
    expect(matchesWords(`${both('view.settings')} settings`, '設定')).toBe(true);
    expect(matchesWords(search, 'zzz')).toBe(false);
    expect(resolveLang('auto', 'ja-JP')).toBe('ja');
    expect(resolveLang('en', 'ja-JP')).toBe('en');
  });
  it('key labels follow the platform', () => {
    expect(keyLabel('Alt+Shift+1', false)).toBe('Alt+Shift+1');
    expect(keyLabel('Mod+Enter', false)).toBe('Ctrl+Enter');
    expect(keyLabel('Mod+Enter', true)).toBe('⌘↩');
  });
  it('the key table: words for every binding, caps as the device prints them, events that match', () => {
    for (const id of Object.keys(KEYS) as KeyId[]) {
      expect(en[keyText(id)] && ja[keyText(id)], id).toBeTruthy();
      expect(
        keyCaps(id, false).every((cap) => cap.length > 0),
        id,
      ).toBe(true);
    }
    expect(keyCaps('workspace', false)).toEqual(['Alt+Shift+1 … 9']);
    expect(keyCaps('send', true)).toEqual(['⌘↩']);
    expect(keyCaps('play', false)).toEqual(['Space', 'K']);
    expect(keyCaps('zoomIn', false)).toEqual(['+', '=']);
    const key = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', init);
    expect(pressed(key({ key: '/', code: 'Slash' }), 'filter')).toBe(true);
    expect(pressed(key({ key: '?', code: 'Slash', shiftKey: true }), 'filter')).toBe(false);
    expect(pressed(key({ key: '/', code: 'Slash', ctrlKey: true }), 'filter')).toBe(false);
    expect(pressed(key({ key: '+', code: 'Semicolon', shiftKey: true }), 'zoomIn')).toBe(true);
    expect(pressed(key({ key: ' ', code: 'Space' }), 'play')).toBe(true);
    expect(pressed(key({ key: 'k', code: 'KeyK' }), 'play')).toBe(true);
    expect(pressed(key({ key: 'Enter', isComposing: true }), 'launcherPick')).toBe(false);
    expect(
      pressedAt(key({ key: '#', code: 'Digit3', altKey: true, shiftKey: true }), 'workspace'),
    ).toBe(2);
  });
  it('keys: a held key acts once, a pair needs its first key, typing and composing are left alone', () => {
    const key = (init: KeyboardEventInit): KeyboardEvent =>
      new KeyboardEvent('keydown', { bubbles: true, ...init });
    expect(pressed(key({ key: 'l', code: 'KeyL' }), 'like')).toBe(true);
    expect(pressed(key({ key: 'l', code: 'KeyL', repeat: true }), 'like')).toBe(false);
    expect(pressed(key({ key: 'j', code: 'KeyJ', repeat: true }), 'next')).toBe(true);
    expect(pressed(key({ key: 'l', code: 'KeyL', ctrlKey: true }), 'like')).toBe(false);
    expect(pressed(key({ key: 'Process', code: 'KeyJ', keyCode: 229 }), 'next')).toBe(false);
    expect(pressed(key({ key: '?', code: 'Slash', shiftKey: true }), 'help')).toBe(true);
    expect(keyCaps('goHome', false)).toEqual(['G H']);
    expect(keyCaps('tabReopen', false)).toEqual(['Alt+Shift+T']);
    expect(keyCaps('clickSplit', false)).toEqual(['Shift+Click']);

    watchPairs(window);
    const send = (init: KeyboardEventInit, on: EventTarget = window): KeyboardEvent => {
      const e = key(init);
      on.dispatchEvent(e);
      return e;
    };
    const lone = send({ key: 'b', code: 'KeyB' });
    expect([pressed(lone, 'bookmark'), pressed(lone, 'goBookmarks')]).toEqual([true, false]);
    send({ key: 'g', code: 'KeyG' });
    const second = send({ key: 'b', code: 'KeyB' });
    expect([pressed(second, 'bookmark'), pressed(second, 'goBookmarks')]).toEqual([false, true]);
    const third = send({ key: 'b', code: 'KeyB' });
    expect(pressed(third, 'bookmark')).toBe(true);
    // A "g" typed into a field starts nothing.
    const input = document.body.appendChild(document.createElement('input'));
    send({ key: 'g', code: 'KeyG' }, input);
    const after = send({ key: 'h', code: 'KeyH' });
    expect(pressed(after, 'goHome')).toBe(false);
    input.remove();
  });
  it('addresses are tidied as typed, and nonsense is refused', () => {
    expect(relayAddress(' relay.example.jp/ ')).toBe('wss://relay.example.jp');
    expect(relayAddress('WSS://Relay.Example.JP/inbox')).toBe('wss://relay.example.jp/inbox');
    expect(relayAddress('https://relay.example.jp')).toBeUndefined();
    expect(relayAddress('not a relay')).toBeUndefined();
    expect(serverAddress('media.example.jp')).toBe('https://media.example.jp');
    expect(serverAddress('http://media.example.jp')).toBeUndefined();
  });
  it('a redrawn list keeps unchanged nodes and the keyboard on the same control', () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const cache = new Map();
    const render = (r: { key: string; on: boolean }): HTMLElement => {
      const el = document.createElement('div');
      const b = document.createElement('button');
      b.dataset.f = 'flip';
      b.textContent = String(r.on);
      el.append(b);
      return el;
    };
    reconcile(
      parent,
      cache,
      [
        { key: 'a', on: false },
        { key: 'b', on: false },
        { key: 'c', on: false },
      ],
      render,
    );
    const [a, b] = [...parent.children] as HTMLElement[];
    b?.querySelector('button')?.focus();
    reconcile(
      parent,
      cache,
      [
        { key: 'a', on: false },
        { key: 'b', on: true },
        { key: 'c', on: false },
      ],
      render,
    );
    expect(parent.children[0]).toBe(a);
    expect(parent.children[1]).not.toBe(b);
    expect(document.activeElement?.textContent).toBe('true');
    reconcile(
      parent,
      cache,
      [
        { key: 'a', on: false },
        { key: 'c', on: false },
      ],
      render,
    );
    expect(parent.children).toHaveLength(2);
    expect(document.activeElement?.closest<HTMLElement>('[data-key]')?.dataset.key).toBe('c');
    parent.remove();
  });
});

describe('formats', () => {
  const at = new Date(2026, 10, 14, 9, 5, 0).getTime();
  const now = new Date(2026, 10, 14, 15, 0, 0).getTime();
  it('dates are absolute: yyyy/mm/dd, HH:mm within the day', () => {
    expect(dayOf(at)).toBe('2026/11/14');
    expect(clockOf(at)).toBe('09:05');
    expect(noteTime(at, now, { relative: false, lang: 'en' })).toBe('09:05');
    expect(noteTime(at - 86_400_000, now, { relative: false, lang: 'ja' })).toBe(
      '2026/11/13 09:05',
    );
    expect(noteTime(now - 180_000, now, { relative: true, lang: 'ja' })).toBe('3分前');
  });
  it('counts shorten, and say when they are lower bounds', () => {
    expect(countText(12, true, 'en')).toBe('12+');
    expect(countText(2100, false, 'en')).toBe('2.1k');
    expect(countText(21000, false, 'ja')).toBe('2.1万');
  });
  it('notification toggles: nothing picked is everything; replies bring mentions', () => {
    expect(typesQuery([])).toBeUndefined();
    expect(typesQuery(['reply', 'zap'])).toEqual(['reply', 'mention', 'zap']);
  });
  it('emoji are found in both languages, and the latest used comes first, once', () => {
    expect(findGlyphs('cat').map((g) => g.emoji)).toContain('🐱');
    expect(findGlyphs('ねこ')[0]?.emoji).toBe('🐱');
    expect(findGlyphs('').length).toBeGreaterThan(120);
    expect(isEmoji('🫠') && isEmoji('👍🏽') && !isEmoji('ab')).toBe(true);
    expect(withRecent([{ emoji: 'a' }, { emoji: 'b' }], { emoji: 'b' })).toEqual([
      { emoji: 'b' },
      { emoji: 'a' },
    ]);
  });
  it('settings keep only valid stored values', () => {
    expect(parseSettings({ textSize: 19, theme: 'neon', uiScale: 9 })).toEqual({
      ...DEFAULT_SETTINGS,
      textSize: 19,
    });
  });
});
