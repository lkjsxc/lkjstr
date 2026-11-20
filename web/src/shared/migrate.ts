// One-time repair of saved UI state from the pre-feedback builds. Never reset an arrangement that differs
// from an old default. IDs were random even in defaults: reconstruct the old template with those same IDs,
// then require byte equality (including active tabs, sizes and property order) before replacing it.
import { type LayoutNode, pane, split } from '../wm/layout.ts';
import { parseLayout } from '../wm/layout-parse.ts';
import { homePreset } from '../wm/presets.ts';
import { kv } from './storage.ts';

const VERSION = 'owner-audit-1';
const oldHomes = (): LayoutNode[] => [
  pane(['home', 'notifications', 'global', 'compose']),
  split('row', [pane(['home', 'global']), pane(['notifications', 'compose'])], [0.56, 0.44]),
  split(
    'row',
    [
      pane(['home']),
      split('col', [pane(['notifications']), pane(['compose'])], [0.64, 0.36]),
      pane(['global', 'bookmarks']),
    ],
    [0.38, 0.28, 0.34],
  ),
];
const withIds = (template: LayoutNode, value: LayoutNode): LayoutNode => ({
  ...template,
  id: value.id,
  ...(template.type === 'split' && value.type === 'split' && Array.isArray(value.children)
    ? {
        children: template.children.map((c, i) => withIds(c, value.children[i] ?? c)),
      }
    : {}),
});
export function oldDefault(value: unknown, family: string): boolean {
  if (!parseLayout(value)) return false;
  const candidates = family === 'guest' ? [pane(['global'])] : oldHomes();
  return candidates.some(
    (p) => JSON.stringify(withIds(p, value as LayoutNode)) === JSON.stringify(value),
  );
}

/** Workspace 1 as it started from 2026-11-15 to 2026-11-20: Global and Home at the left, Post over Accounts,
 * Notifications and Settings at the right. The first page load saved it, so an untouched one is this, exactly. */
const twoColumns = (width: number, family: string): LayoutNode => {
  const guest = family === 'guest';
  const own = ['account', 'notifications', 'settings'];
  const read = pane(['global', 'home'], guest ? 'global' : 'home');
  if (width < 760) return pane([...read.tabs, 'compose', ...own], read.active);
  const right = split(
    'col',
    [pane(['compose']), pane(own, guest ? 'account' : 'notifications')],
    [0.34, 0.66],
  );
  return split('row', [read, right], width < 1200 ? [0.56, 0.44] : [0.6, 0.4]);
};
const DEFAULTS = 'three-columns-1';
/** A workspace 1 never rearranged takes up today's default; one that differs in anything is the reader's and stays
 * until they reset it. Runs once, apart from `migrateStorage`, so that one's steps do not run again. */
export function adoptDefault(): void {
  if (kv.get('defaults') === DEFAULTS) return;
  for (const family of ['main', 'guest']) {
    const key = `layout:${family}`;
    const value = kv.get(key);
    const same = (w: number): boolean =>
      parseLayout(value) !== null &&
      JSON.stringify(withIds(twoColumns(w, family), value as LayoutNode)) === JSON.stringify(value);
    if ([1440, 1024, 390].some(same)) kv.set(key, homePreset(undefined, family));
  }
  kv.set('defaults', DEFAULTS);
}

export function migrateStorage(): void {
  adoptDefault();
  if (kv.get('migration') === VERSION) return;
  for (const family of ['main', 'guest']) {
    const key = `layout:${family}`;
    if (oldDefault(kv.get(key), family)) kv.set(key, homePreset(undefined, family));
  }
  // Retired About/Shortcuts tabs become Docs pages in their original tile, including closed tabs. Allocate
  // names within each workspace so existing Docs tabs and their state cannot be overwritten.
  const renames = new Map<string, string>(); // bound: one per saved retired tab
  for (const key of kv.keys('layout:')) {
    if (key.endsWith(':spaces')) continue;
    const value = kv.get(key);
    const family = key.split(':')[1] ?? 'main';
    const instance = `${family}${key.split(':')[2] ?? '1'}`;
    const used = new Set(
      kv.keys(`view:${instance}:`).map((k) => k.slice(`view:${instance}:`.length)),
    );
    const reserve = (v: unknown): void => {
      const n = object(v);
      if (Array.isArray(n.tabs)) for (const t of n.tabs) used.add(String(t));
      if (Array.isArray(n.children)) n.children.forEach(reserve);
    };
    reserve(value);
    const walk = (v: unknown): unknown => {
      if (!v || typeof v !== 'object') return v;
      const n = v as Record<string, unknown>;
      if (Array.isArray(n.children)) return { ...n, children: n.children.map(walk) };
      if (!Array.isArray(n.tabs)) return n;
      const rename = (tab: string): string => {
        const page = tab.split('~')[0];
        if (page !== 'about' && page !== 'shortcuts') return tab;
        const old = `${instance}:${tab}`;
        const existing = renames.get(old);
        if (existing) return existing;
        let fresh = 'docs';
        for (let i = 2; used.has(fresh); i++) fresh = `docs~${i}`;
        used.add(fresh);
        renames.set(old, fresh);
        kv.set(`view:${instance}:${fresh}`, { ...object(kv.get(`view:${old}`)), page });
        kv.remove(`view:${old}`);
        return fresh;
      };
      return { ...n, tabs: n.tabs.map((t) => rename(String(t))), active: rename(String(n.active)) };
    };
    kv.set(key, walk(value));
  }
  for (const key of kv.keys('closed:')) {
    const value = kv.get(key);
    if (Array.isArray(value))
      kv.set(
        key,
        value.map((tab) => {
          const n = object(tab);
          return n.kind === 'about' || n.kind === 'shortcuts'
            ? { ...n, kind: 'docs', state: { ...object(n.state), page: n.kind } }
            : n;
        }),
      );
  }
  for (const key of kv.keys('view:')) {
    const state = object(kv.get(key));
    // Static titles are translated at render time. Old saved translations must not override today's labels.
    const kind = key.split(':')[2]?.split('~')[0];
    if (kind && !['profile', 'thread', 'hashtag', 'media', 'channel'].includes(kind))
      delete state.title;
    const filter = object(state.filter);
    if (filter.range === 'day' || filter.range === 'week') {
      const days = filter.range === 'day' ? 1 : 7;
      const day = new Date(Date.now() - days * 86400000);
      filter.start = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      delete filter.range;
      state.filter = filter;
    }
    kv.set(key, state);
  }
  kv.set('migration', VERSION);
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? ({ ...v } as Record<string, unknown>) : {};
