// Reset layout and its Undo lose nothing: put-away tabs wait as a batch, Undo lapses once it could lose state, a full
// device changes nothing, and the stored layouts are never written back over another browser tab's change.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLang } from '../src/shared/i18n.ts';
import { kv } from '../src/shared/storage.ts';
import {
  dropViewState,
  loadViewState,
  restoreViewState,
  saveViewState,
  snapshotViewState,
} from '../src/shared/view-state.ts';
import { createClosed, holdsTyped, parseClosed } from '../src/wm/closed.ts';
import * as L from '../src/wm/layout.ts';
import { homePreset } from '../src/wm/presets.ts';
import { resetLayout, retireSaved } from '../src/wm/reset.ts';
import { createWmStore } from '../src/wm/store.ts';

afterEach(() => {
  localStorage.clear();
  setLang('en');
});
const shape = (n: L.LayoutNode): unknown =>
  n.type === 'pane' ? n.tabs.join('|') : { [n.dir]: n.children.map(shape) };

describe('Reset layout', () => {
  // A workspace as a controller keeps it: the layout, its tabs' stored state, and its closed tabs.
  // A workspace as a controller keeps it: the layout, its tabs' stored state (the real view-state functions), and
  // its closed tabs.
  const world = (start: L.LayoutNode, drafts: Record<string, string>) => {
    let root = start;
    const closed = createClosed('main1');
    for (const [view, text] of Object.entries(drafts)) saveViewState(`main1:${view}`, { text });
    const at = (view: string): string => `main1:${view}`;
    const parts = {
      root: () => root,
      set: (next: L.LayoutNode) => void (root = next),
      own: {
        unmount() {},
        held: (view: string) => snapshotViewState(at(view)),
        drop: (view: string) => dropViewState(at(view)),
        revive(view: string, state?: object) {
          dropViewState(at(view));
          return !state || restoreViewState(at(view), state);
        },
      },
      closed,
      live: () => true,
    };
    return { parts, now: () => root, closed };
  };
  const text = (view: string): unknown => loadViewState<{ text: string }>(`main1:${view}`).text;
  const stored = () => parseClosed(kv.get('closed:main1'));
  const states = () => stored().map((c) => [c.kind, (c.state as { text?: string }).text]);
  const twoPosts = () =>
    L.split('row', [L.pane(['home', 'compose~2'], 'compose~2'), L.pane(['docs', 'new'])]);

  it('gives the default, keeps what the closed tabs held, and Undo puts everything back', () => {
    const w = world(twoPosts(), { 'compose~2': 'half a note' });
    const before = JSON.stringify(w.now());
    const r = resetLayout(w.parts, homePreset(1440));
    expect(shape(w.now())).toEqual(shape(homePreset(1440)));
    // The draft waits in the closed tabs, to be reopened; a New tab page leaves nothing.
    expect(states()).toEqual([
      ['compose', 'half a note'],
      ['docs', undefined],
    ]);
    expect(kv.get('view:main1:compose~2')).toBeUndefined();
    expect(r?.undo()).toBe(true);
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
    expect(r?.undoable()).toBe(false);
    expect(r?.undo()).toBe(false);
    expect(text('compose~2')).toBe('new draft');
    expect(states()).toContainEqual(['compose', 'old draft']);
  });

  it('ends the Undo once another browser tab reopens one of the tabs it put away', () => {
    const w = world(twoPosts(), { 'compose~2': 'old draft' });
    const r = resetLayout(w.parts, homePreset(1440));
    const other = createClosed('main1'); // the same workspace in another browser tab
    expect(other.pop()?.kind).toBe('docs');
    expect(r?.undo()).toBe(false);
    expect(states()).toEqual([['compose', 'old draft']]);
  });

  it('Undo closes a tab the reset brought in, with what was typed there, the ordinary way', () => {
    const w = world(L.pane(['home', 'compose~2']), { 'compose~2': 'kept' });
    const r = resetLayout(w.parts, homePreset(1440));
    saveViewState('main1:settings', { drafts: { 'set.relayList': 'wss://half' } });
    saveViewState('main1:notifications', { scroll: { self: 40 } });
    expect(r?.undo()).toBe(true);
    expect(L.views(w.now())).toEqual(['home', 'compose~2']);
    expect(text('compose~2')).toBe('kept');
    // Only the tab something was typed in; one merely scrolled, or left as it came, just goes.
    expect(stored().map((c) => [c.kind, c.state])).toEqual([
      ['settings', { drafts: { 'set.relayList': 'wss://half' }, tabCompanions: {} }],
    ]);
    expect(kv.get('view:main1:settings')).toBeUndefined();
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
    expect(r?.undo()).toBe(true);
    for (const v of extra) expect(text(v), v).toBe(v);
    expect(stored().map((c) => c.state)).toEqual(
      Array.from({ length: 20 }, (_, i) => ({ i: i + 1 })),
    );
  });

  it('another browser tab closing a tab keeps what this one put away', () => {
    const here = createClosed('main1');
    const other = createClosed('main1');
    const [kept] =
      here.pushBatch([{ kind: 'compose', state: { text: 'a' }, pane: '', index: 0 }], 'b') ?? [];
    if (!kept) throw new Error('not kept');
    other.push({ kind: 'settings', state: {}, pane: '', index: 0 });
    expect(stored().map((c) => c.kind)).toEqual(['compose', 'settings']);
    expect(other.take(kept.id)?.state).toEqual({ text: 'a' });
    expect(here.has(kept.id)).toBe(false);
  });

  it('every layout: a workspace not on screen sends its extra tabs to its own closed tabs', () => {
    saveViewState('main2:compose', { text: 'in workspace 2' });
    saveViewState('main2:global', { filter: 'kept' });
    const two = L.pane(['global', 'compose', 'new'], 'compose');
    expect(retireSaved(JSON.parse(JSON.stringify(two)), 'main', 2)).toBe(true);
    expect(parseClosed(kv.get('closed:main2')).map((c) => [c.kind, c.state])).toEqual([
      ['compose', { text: 'in workspace 2', tabCompanions: {} }],
    ]);
    expect(kv.get('view:main2:compose')).toBeUndefined();
    expect(loadViewState('main2:global')).toEqual({ filter: 'kept' });
  });
  it("a reset's typed drafts are never pushed out by later resets; tabs holding nothing are", () => {
    const closed = createClosed('main1');
    const tab = (text?: string) => ({
      kind: 'compose',
      state: text ? { text } : {},
      pane: '',
      index: 0,
    });
    const [first] = closed.pushBatch([tab('the one draft')], 'one') ?? [];
    closed.pushBatch([tab()], 'two');
    closed.pushBatch(
      Array.from({ length: 100 }, () => tab()),
      'three',
    );
    expect(closed.has(first?.id ?? '')).toBe(true);
    expect(stored().filter((c) => c.batch === 'two')).toHaveLength(0); // nothing typed: the cap applies
    expect(stored().filter((c) => c.batch === 'three')).toHaveLength(100);
    expect(
      holdsTyped({ text: ' ', drafts: {}, tabCompanions: { ':outbox': { id: 'x', drafts: [] } } }),
    ).toBe(false);
    expect(holdsTyped({ tabCompanions: { ':outbox': { id: 'x', drafts: [{ draft: {} }] } } })).toBe(
      true,
    );
    expect(holdsTyped({ drafts: { 'set.relayList': 'wss://half' } })).toBe(true);
  });

  /** A device with no room left for one key (writes of every other key go through). */
  const refusals: { mockRestore(): void }[] = [];
  afterEach(() => refusals.splice(0).forEach((spy) => spy.mockRestore()));
  const refuse = (key: string) => {
    const set = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k, v) => {
      if (k === key) throw new DOMException('full', 'QuotaExceededError');
      set(k, v);
    });
    refusals.push(spy);
  };
  it('a workspace whose closed tabs cannot be stored keeps its layout and every draft', () => {
    saveViewState('main2:compose~2', { text: 'in workspace 2' });
    refuse('lkjstr:closed:main2');
    expect(retireSaved(L.pane(['global', 'compose~2']), 'main', 2)).toBe(false);
    expect(loadViewState('main2:compose~2')).toEqual({ text: 'in workspace 2' });
    expect(kv.get('closed:main2')).toBeUndefined();
  });
  it('the shown workspace: no room for the closed tabs leaves the layout and the drafts as they were', () => {
    const w = world(twoPosts(), { 'compose~2': 'stays' });
    const before = JSON.stringify(w.now());
    refuse('lkjstr:closed:main1');
    expect(resetLayout(w.parts, homePreset(1440))).toBeUndefined();
    expect(JSON.stringify(w.now())).toBe(before);
    expect(text('compose~2')).toBe('stays');
  });
  it('Undo with no room to give a draft back leaves it in the closed tabs', () => {
    const w = world(twoPosts(), { 'compose~2': 'waits' });
    const r = resetLayout(w.parts, homePreset(1440));
    refuse('lkjstr:view:main1:compose~2');
    expect(r?.undo()).toBe(false);
    expect(shape(w.now())).toEqual(shape(homePreset(1440)));
    expect(states()).toContainEqual(['compose', 'waits']);
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
