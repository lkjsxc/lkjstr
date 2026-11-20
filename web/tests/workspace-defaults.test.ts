// The owner's 2026-11-20 workspace: one Documentation entry on the New tab page, the three-column default, a saved
// arrangement kept until the reader resets it, and a reset that loses nothing and can be undone.
import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../src/shared/i18n.ts';
import { adoptDefault, migrateStorage } from '../src/shared/migrate.ts';
import { kv } from '../src/shared/storage.ts';
import { loadViewState, saveViewState } from '../src/shared/view-state.ts';
import { setServed } from '../src/views/registry.ts';
import { CHOICES } from '../src/wm/choices.ts';
import { createClosed, parseClosed } from '../src/wm/closed.ts';
import * as L from '../src/wm/layout.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';
import { homePreset } from '../src/wm/presets.ts';
import { resetLayout, retireSaved } from '../src/wm/reset.ts';
import { createWmStore } from '../src/wm/store.ts';
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

describe('Reset layout', () => {
  // A workspace as a controller keeps it: the layout, its tabs' stored state, and its closed tabs.
  const world = (start: L.LayoutNode, drafts: Record<string, string>) => {
    let root = start;
    const closed = createClosed('main1');
    for (const [view, text] of Object.entries(drafts)) saveViewState(`main1:${view}`, { text });
    const parts = {
      root: () => root,
      set: (next: L.LayoutNode) => void (root = next),
      retire(view: string, batch?: string) {
        const state = loadViewState(`main1:${view}`);
        localStorage.removeItem(`lkjstr:view:main1:${view}`);
        if (view.startsWith('new')) return;
        return closed.push(
          { kind: view.split('~')[0] as string, state, pane: '', index: 0 },
          batch,
        );
      },
      own: {
        held: (view: string) => loadViewState(`main1:${view}`),
        revive(view: string, state?: object) {
          localStorage.removeItem(`lkjstr:view:main1:${view}`);
          if (state) saveViewState(`main1:${view}`, state);
        },
      },
      closed,
      live: () => true,
    };
    return { parts, now: () => root, closed };
  };
  const text = (view: string): unknown => loadViewState<{ text: string }>(`main1:${view}`).text;
  const stored = () => parseClosed(kv.get('closed:main1'));
  const twoPosts = () =>
    L.split('row', [L.pane(['home', 'compose~2'], 'compose~2'), L.pane(['docs', 'new'])]);

  it('gives the default, keeps what the closed tabs held, and Undo puts everything back', () => {
    const w = world(twoPosts(), { 'compose~2': 'half a note' });
    const before = JSON.stringify(w.now());
    const r = resetLayout(w.parts, homePreset(1440));
    expect(shape(w.now())).toEqual(shape(homePreset(1440)));
    // The draft waits in the closed tabs, to be reopened; a New tab page leaves nothing.
    expect(stored().map((c) => [c.kind, c.state])).toEqual([
      ['compose', { text: 'half a note' }],
      ['docs', {}],
    ]);
    expect(r.undo()).toBe(true);
    expect(JSON.stringify(w.now())).toBe(before);
    expect(w.closed.size()).toBe(0);
    expect(text('compose~2')).toBe('half a note');
  });

  it('ends the Undo once a tab is opened or reopened, so a later draft is never overwritten', () => {
    const w = world(twoPosts(), { 'compose~2': 'old draft' });
    const r = resetLayout(w.parts, homePreset(1440));
    // A new Post tab takes the free id compose~2 and gets a draft of its own.
    w.parts.set(L.addView(w.now(), L.panes(w.now())[0]?.id ?? '', 'compose~2', 'center'));
    saveViewState('main1:compose~2', { text: 'new draft' });
    expect(r.undoable()).toBe(false);
    expect(r.undo()).toBe(false);
    expect(text('compose~2')).toBe('new draft');
    expect(stored().map((c) => c.state)).toContainEqual({ text: 'old draft' });
  });

  it('ends the Undo once another browser tab reopens one of the tabs it put away', () => {
    const w = world(twoPosts(), { 'compose~2': 'old draft' });
    const r = resetLayout(w.parts, homePreset(1440));
    const other = createClosed('main1'); // the same workspace in another browser tab
    expect(other.pop()?.kind).toBe('docs');
    expect(r.undo()).toBe(false);
    expect(stored().map((c) => c.state)).toEqual([{ text: 'old draft' }]);
  });

  it('Undo closes a tab the reset brought in, with what was typed there, the ordinary way', () => {
    const w = world(L.pane(['home', 'compose~2']), { 'compose~2': 'kept' });
    const r = resetLayout(w.parts, homePreset(1440));
    saveViewState('main1:settings', { drafts: { 'set.relayList': 'wss://half' } });
    saveViewState('main1:notifications', { scroll: { self: 40 } });
    expect(r.undo()).toBe(true);
    expect(L.views(w.now())).toEqual(['home', 'compose~2']);
    expect(text('compose~2')).toBe('kept');
    // Only the tab something was typed in; one merely scrolled, or left as it came, just goes.
    expect(stored().map((c) => [c.kind, c.state])).toEqual([
      ['settings', { drafts: { 'set.relayList': 'wss://half' } }],
    ]);
  });

  it('puts away any number of tabs without pushing out the closed tabs, and Undo restores every draft', () => {
    const closed = createClosed('main1');
    for (let i = 0; i < 20; i++) closed.push({ kind: 'thread', state: { i }, pane: '', index: 0 });
    const extra = Array.from({ length: 21 }, (_, i) => `compose~${i + 2}`);
    const w = world(L.pane(['home', ...extra]), Object.fromEntries(extra.map((v) => [v, v])));
    const r = resetLayout(w.parts, homePreset(1440));
    expect(w.closed.size()).toBe(41);
    expect(stored().filter((c) => c.kind === 'thread')).toHaveLength(20);
    // Closing more tabs one by one pushes out only the oldest single closes.
    closed.push({ kind: 'thread', state: { i: 20 }, pane: '', index: 0 });
    expect(stored().filter((c) => c.batch)).toHaveLength(21);
    expect(r.undo()).toBe(true);
    for (const v of extra) expect(text(v), v).toBe(v);
    expect(stored().map((c) => c.state)).toEqual(
      Array.from({ length: 20 }, (_, i) => ({ i: i + 1 })),
    );
  });

  it('another browser tab closing a tab keeps what this one put away', () => {
    const here = createClosed('main1');
    const other = createClosed('main1');
    const kept = here.push({ kind: 'compose', state: { text: 'a' }, pane: '', index: 0 }, 'b');
    other.push({ kind: 'settings', state: {}, pane: '', index: 0 });
    expect(stored().map((c) => c.kind)).toEqual(['compose', 'settings']);
    expect(other.take(kept.id)?.state).toEqual({ text: 'a' });
    expect(here.has(kept.id)).toBe(false);
  });

  it('every layout: a workspace not on screen sends its extra tabs to its own closed tabs', () => {
    saveViewState('main2:compose', { text: 'in workspace 2' });
    saveViewState('main2:global', { filter: 'kept' });
    const two = L.pane(['global', 'compose', 'new'], 'compose');
    retireSaved(JSON.parse(JSON.stringify(two)), 'main', 2);
    expect(parseClosed(kv.get('closed:main2')).map((c) => [c.kind, c.state])).toEqual([
      ['compose', { text: 'in workspace 2', tabCompanions: {} }],
    ]);
    expect(kv.get('view:main2:compose')).toBeUndefined();
    expect(loadViewState('main2:global')).toEqual({ filter: 'kept' });
  });
});

describe('the stored layouts', () => {
  it('a page that just loaded does not write back the layout it read, so it cannot undo another tab', async () => {
    localStorage.setItem('lkjstr:layout:main', JSON.stringify({ tabs: ['home'], type: 'pane' }));
    const store = createWmStore();
    store.space('main', 1).save({ type: 'pane', tabs: ['home'] });
    localStorage.setItem('lkjstr:layout:main', JSON.stringify({ type: 'pane', tabs: ['global'] }));
    await new Promise((done) => setTimeout(done, 500));
    store.dispose();
    expect(kv.get('layout:main')).toEqual({ type: 'pane', tabs: ['global'] });
  });
});
