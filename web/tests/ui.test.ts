import { describe, expect, it } from 'vitest';
import { clockOf, countText, dayOf, noteTime } from '../src/shared/format.ts';
import { both, resolveLang } from '../src/shared/i18n.ts';
import { keyLabel } from '../src/shared/platform.ts';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_SCHEMA } from '../src/shared/settings.ts';
import { en } from '../src/shared/strings-en.ts';
import { ja } from '../src/shared/strings-ja.ts';
import { filterActive, filterQuery } from '../src/views/filter-bar.ts';
import { freshTab, kindOf, VIEWS } from '../src/views/registry.ts';
import { matchesWords } from '../src/wm/launcher.ts';
import * as L from '../src/wm/layout.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';
import { homePreset, presetOf } from '../src/wm/presets.ts';
import { insertAt, zoneAt } from '../src/wm/tab-drag.ts';

const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };

describe('layout', () => {
  it('presets follow the window width and only name known views', () => {
    expect(shape(homePreset(1440))).toEqual({
      row: ['home', { col: ['notifications', 'compose'] }, 'global|bookmarks'],
    });
    expect(shape(homePreset(1024))).toEqual({ row: ['home|global', 'notifications|compose'] });
    expect(shape(homePreset(390))).toBe('home|notifications|global|compose');
    expect(shape(presetOf(5))).toBe('new');
    const known = new Set(VIEWS.map((v) => v.id));
    expect(L.views(homePreset(1440)).filter((v) => !known.has(v))).toEqual([]);
  });
  it('a new tab is inserted right after the tab it was opened from, in the same pane', () => {
    const root = homePreset(1024);
    const p = L.paneOfView(root, 'home') as L.PaneNode;
    const next = L.moveView(root, 'thread', p.id, 'center', 1);
    expect(shape(next)).toEqual({ row: ['home|thread|global', 'notifications|compose'] });
    expect(L.paneOfView(next, 'thread')?.active).toBe('thread');
    expect(L.panes(next)).toHaveLength(2);
  });
  it('split, close and stored layouts round-trip', () => {
    const root = homePreset(1024);
    const p = L.paneOfView(root, 'home') as L.PaneNode;
    const split = L.moveView(root, 'global', p.id, 'right');
    expect(shape(split)).toEqual({ row: ['home', 'global', 'notifications|compose'] });
    expect(shape(L.removeView(split, 'global') as L.LayoutNode)).toEqual({
      row: ['home', 'notifications|compose'],
    });
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
});

describe('formats', () => {
  const at = new Date(2026, 10, 14, 9, 5, 0).getTime();
  const now = new Date(2026, 10, 14, 15, 0, 0).getTime();
  it('dates are absolute: yyyy/mm/dd, HH:mm within the day', () => {
    expect(dayOf(at)).toBe('2026/11/14');
    expect(clockOf(at)).toBe('09:05');
    expect(noteTime(at, now, { relative: false, lang: 'en', dated: false })).toBe('09:05');
    expect(noteTime(at - 86_400_000, now, { relative: false, lang: 'ja', dated: false })).toBe(
      '2026/11/13 09:05',
    );
    expect(noteTime(at - 86_400_000, now, { relative: false, lang: 'ja', dated: true })).toBe(
      '09:05',
    );
    expect(noteTime(now - 180_000, now, { relative: true, lang: 'ja', dated: false })).toBe(
      '3分前',
    );
  });
  it('counts shorten, and say when they are lower bounds', () => {
    expect(countText(12, true, 'en')).toBe('12+');
    expect(countText(2100, false, 'en')).toBe('2.1k');
    expect(countText(21000, false, 'ja')).toBe('2.1万');
  });
  it('a filter becomes query fields; an untouched one adds nothing', () => {
    expect(filterQuery({}, 0)).toEqual({});
    expect(
      filterQuery({ text: ' 猫 ', replies: false, media: 'only', range: 'day' }, 86_400_000),
    ).toEqual({ text: '猫', replies: false, media: 'only', since: 0 });
    expect(filterActive({ text: 'x' })).toBe(false);
    expect(filterActive({ reposts: false })).toBe(true);
  });
  it('settings keep only valid stored values', () => {
    expect(parseSettings({ textSize: 19, theme: 'neon', uiScale: 9 })).toEqual({
      ...DEFAULT_SETTINGS,
      textSize: 19,
    });
  });
});
