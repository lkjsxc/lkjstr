// The owner's 2026-11-20 workspace: one Documentation entry on the New tab page, the three-column default, and a
// saved arrangement kept until the reader resets it (the reset itself: workspace-reset.test.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../src/shared/i18n.ts';
import { adoptDefault, migrateStorage } from '../src/shared/migrate.ts';
import { kv } from '../src/shared/storage.ts';
import { setServed } from '../src/views/registry.ts';
import { CHOICES } from '../src/wm/choices.ts';
import { parseClosed } from '../src/wm/closed.ts';
import * as L from '../src/wm/layout.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';
import { homePreset } from '../src/wm/presets.ts';
import { tabHits } from '../src/wm/tab-search.ts';

afterEach(() => {
  localStorage.clear();
  setLang('en');
});
const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };
const known = { has: (tab: string) => tab !== 'welcome' };

describe('Documentation on the New tab page', () => {
  it('is one card; its pages come up by name once something is typed', () => {
    setServed(8);
    const docs = CHOICES.choices().filter((c) => c.kind === 'docs');
    expect(docs.map((c) => [c.title, c.state])).toEqual([['Documentation', undefined]]);
    expect(CHOICES.choices().some((c) => c.title === 'Shortcuts')).toBe(false);
    const named: [string, string][] = [
      ['shortcuts', 'shortcuts'],
      ['Version', 'about'],
      ['terms', 'terms'],
      ['ショートカット', 'shortcuts'],
    ];
    for (const [typed, page] of named)
      expect(CHOICES.typed(typed)[0]?.state, typed).toEqual({ page });
    expect(CHOICES.typed('#nostr').some((c) => c.kind === 'docs')).toBe(false);
  });
  it('tab search still goes to a page by its name', () => {
    const api = { tabs: () => [], show() {}, open() {} };
    expect(tabHits(api, 'terms')[0]?.title).toBe('Terms');
    expect(tabHits(api, '').filter((h) => h.title === 'Documentation')).toHaveLength(1);
    expect(tabHits(api, '').some((h) => h.title === 'Privacy policy')).toBe(false);
  });
});

describe('the default arrangement', () => {
  it('the desktop default: Home, Notifications, then Post over Accounts and Settings in equal halves', () => {
    const root = homePreset(1440) as L.SplitNode;
    expect(root.sizes).toEqual([0.4, 0.3, 0.3]);
    expect((root.children[2] as L.SplitNode).sizes).toEqual([0.5, 0.5]);
    expect((homePreset(1024) as L.SplitNode).children[1]).toMatchObject({ sizes: [0.5, 0.5] });
    expect(L.panes(root).map((p) => p.active)).toEqual([
      'home',
      'notifications',
      'compose',
      'account',
    ]);
  });
});

describe('saved arrangements', () => {
  // What a first page load stored before this change: the old default, retained and saved as is.
  const saved = (width: number, family: string): L.LayoutNode => {
    const guest = family === 'guest';
    const own = ['account', 'notifications', 'settings'];
    const read = L.pane(['global', 'home'], guest ? 'global' : 'home');
    const old =
      width < 760
        ? L.pane([...read.tabs, 'compose', ...own], read.active)
        : L.split(
            'row',
            [
              read,
              L.split(
                'col',
                [L.pane(['compose']), L.pane(own, guest ? 'account' : 'notifications')],
                [0.34, 0.66],
              ),
            ],
            width < 1200 ? [0.56, 0.44] : [0.6, 0.4],
          );
    return JSON.parse(JSON.stringify(L.retainViews(old, known)));
  };
  it('an untouched old default takes up the new one, at every width and for both families', () => {
    for (const width of [1440, 1024, 390])
      for (const family of ['main', 'guest']) {
        localStorage.clear();
        kv.set(`layout:${family}`, saved(width, family));
        adoptDefault();
        const now = parseLayout(kv.get(`layout:${family}`)) as L.LayoutNode;
        expect(shape(now), `${width} ${family}`).toEqual(shape(homePreset(undefined, family)));
      }
  });
  it('anything the reader changed is theirs until they reset it, and data is not touched', () => {
    const touched = [
      L.activate(saved(1440, 'main'), 'global'),
      { ...(saved(1440, 'main') as L.SplitNode), sizes: [0.5, 0.5] },
      L.removeView(saved(1440, 'main'), 'settings') as L.LayoutNode,
    ];
    for (const layout of touched) {
      localStorage.clear();
      kv.set('layout:main', layout);
      kv.set('settings', { theme: 'dark' });
      kv.set('account', 'ab'.repeat(32));
      kv.set('view:main1:compose', { text: 'draft' });
      migrateStorage();
      expect(kv.get('layout:main')).toEqual(layout);
      expect(kv.get('settings')).toEqual({ theme: 'dark' });
      expect(kv.get('account')).toBe('ab'.repeat(32));
      expect(kv.get('view:main1:compose')).toEqual({ text: 'draft' });
    }
  });
  it('runs once', () => {
    kv.set('layout:main', saved(1440, 'main'));
    adoptDefault();
    const first = kv.get('layout:main');
    kv.set('layout:main', saved(1440, 'main'));
    adoptDefault();
    expect(kv.get('layout:main')).not.toEqual(first);
  });
  it('a legacy tab kind (a Welcome page) is dropped from a saved layout and from the closed tabs', () => {
    const old = L.split('row', [L.pane(['welcome']), L.pane(['home', 'docs'], 'docs')]);
    expect(shape(L.retainViews(old, known) as L.LayoutNode)).toBe('home|docs');
    expect(parseClosed([{ kind: 'welcome', state: {}, pane: 'a', index: 0 }])).toEqual([]);
  });
});
