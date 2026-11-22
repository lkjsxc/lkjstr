// The owner's workspace: one Documentation entry on the New tab page, the three-column default with Documentation in
// front of Notifications (2026-11-22), and a saved arrangement kept until the reader resets it (the reset itself:
// workspace-reset.test.ts).
import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../src/shared/i18n.ts';
import { adoptDefault, migrateStorage } from '../src/shared/migrate.ts';
import { kv } from '../src/shared/storage.ts';
import { DOC_PAGES } from '../src/views/docs.ts';
import { filterQuery } from '../src/views/filter-bar.ts';
import { setServed } from '../src/views/registry.ts';
import { CHOICES } from '../src/wm/choices.ts';
import { parseClosed } from '../src/wm/closed.ts';
import * as L from '../src/wm/layout.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';
import { homePreset, LKJSXC, LKJSXC_HOME, PHONE_HOME, startState } from '../src/wm/presets.ts';
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
  it('the desktop default: Home, Documentation over Notifications, then Post over Accounts and Settings', () => {
    const root = homePreset(1440) as L.SplitNode;
    expect(root.sizes).toEqual([0.4, 0.3, 0.3]);
    expect((root.children[2] as L.SplitNode).sizes).toEqual([0.5, 0.5]);
    expect((homePreset(1024) as L.SplitNode).children[1]).toMatchObject({ sizes: [0.5, 0.5] });
    expect(L.panes(root).map((p) => p.active)).toEqual(['home', 'docs', 'compose', 'account']);
  });
  it('what lkjstr is comes first: Documentation is in front of Notifications at every width', () => {
    for (const family of ['main', 'guest']) {
      for (const width of [1440, 1024]) {
        const tile = L.paneOfView(homePreset(width, family), 'notifications') as L.PaneNode;
        expect(tile.tabs.slice(0, 2), `${width} ${family}`).toEqual(['docs', 'notifications']);
        expect(tile.active, `${width} ${family}`).toBe('docs');
      }
      // A phone (owner, 2026-11-22): one tile over Post, collapsed to its bar at the bottom, and no Notifications
      // tab, since they flow into the reader's Home. A visitor starts on Documentation, a reader on Home.
      const phone = homePreset(390, family) as L.SplitNode;
      const [top, post] = L.panes(phone);
      expect(phone.dir).toBe('col');
      expect(top?.active).toBe(family === 'guest' ? 'docs' : PHONE_HOME);
      expect(post).toMatchObject({ tabs: ['compose'], zoom: 'min' });
      expect(L.views(phone)).not.toContain('notifications');
      expect(parseLayout(JSON.parse(JSON.stringify(phone)))).toEqual(phone);
    }
    // A Docs tab with nothing stored opens on its first page, which says what lkjstr is.
    expect(DOC_PAGES[0]?.id).toBe('what');
  });
  it("lkjsxc's Home takes Global's place, for a visitor and a reader, at every width", () => {
    for (const family of ['main', 'guest'])
      for (const width of [1440, 1024, 390]) {
        const root = homePreset(width, family);
        expect(L.views(root), `${width} ${family}`).not.toContain('global');
        expect(L.panes(root)[0]?.tabs.slice(0, 2), `${width} ${family}`).toEqual([
          width < 760 && family === 'main' ? PHONE_HOME : 'home',
          LKJSXC_HOME,
        ]);
      }
    expect((homePreset(1440, 'guest') as L.SplitNode).children[0]).toMatchObject({
      active: LKJSXC_HOME,
    });
    expect(LKJSXC).toMatch(/^[0-9a-f]{64}$/);
    expect(startState(LKJSXC_HOME)).toEqual({ pubkey: LKJSXC, title: "lkjsxc's Home" });
    expect(startState('their-home')).toBeUndefined();
    // The phone's Home starts with notifications flowing in, which is its filter's own option.
    expect(startState(PHONE_HOME)).toEqual({ filter: { news: true } });
    expect(filterQuery({ news: true })).toEqual({ notifications: true });
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
  it('a saved 2026-11-20 default stays as it is: the new default comes only with a reset', () => {
    // Workspace 1 as it started before Documentation joined Notifications (2026-11-20 to 2026-11-22).
    const before = (width: number, family: string): L.LayoutNode => {
      const read = L.pane(['home', 'global'], family === 'guest' ? 'global' : 'home');
      const own = ['account', 'settings'];
      if (width < 760)
        return L.pane([...read.tabs, 'notifications', 'compose', ...own], read.active);
      const right = (tabs: string[]): L.LayoutNode =>
        L.split('col', [L.pane(['compose']), L.pane(tabs, tabs[0])], [0.5, 0.5]);
      return width < 1200
        ? L.split('row', [read, right(['notifications', ...own])], [0.56, 0.44])
        : L.split('row', [read, L.pane(['notifications']), right(own)], [0.4, 0.3, 0.3]);
    };
    for (const width of [1440, 1024, 390])
      for (const family of ['main', 'guest']) {
        localStorage.clear();
        const layout = JSON.parse(JSON.stringify(before(width, family)));
        kv.set(`layout:${family}`, layout);
        migrateStorage();
        expect(kv.get(`layout:${family}`), `${width} ${family}`).toEqual(layout);
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
