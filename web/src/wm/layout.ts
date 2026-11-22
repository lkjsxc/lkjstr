// Pure layout tree (shared with ytenrich). Tabs are view ids; each view appears at most once.
export type ViewId = string;
export type Dir = 'row' | 'col';
export type Zone = 'center' | 'left' | 'right' | 'top' | 'bottom';
/** `max`: the tile fills the workspace (at most one does); `min`: folded to its strip, its room given to its siblings. */
export type Zoom = 'max' | 'min';
export type PaneNode = {
  readonly type: 'pane';
  readonly id: string;
  readonly tabs: readonly ViewId[];
  readonly active: ViewId;
  readonly zoom?: Zoom;
};
export type SplitNode = {
  readonly type: 'split';
  readonly id: string;
  readonly dir: Dir;
  readonly children: readonly LayoutNode[];
  readonly sizes: readonly number[];
};
export type LayoutNode = PaneNode | SplitNode;

const uid = (): string => crypto.randomUUID().slice(0, 8);

export function pane(tabs: readonly ViewId[], active = tabs[0] ?? ''): PaneNode {
  return { type: 'pane', id: uid(), tabs, active };
}

export function split(
  dir: Dir,
  children: readonly LayoutNode[],
  sizes?: readonly number[],
): SplitNode {
  return {
    type: 'split',
    id: uid(),
    dir,
    children,
    sizes: sizes ?? children.map(() => 1 / children.length),
  };
}

export function panes(root: LayoutNode): PaneNode[] {
  return root.type === 'pane' ? [root] : root.children.flatMap(panes);
}

export function paneOfView(root: LayoutNode, view: ViewId): PaneNode | undefined {
  return panes(root).find((p) => p.tabs.includes(view));
}

function mapPanes(root: LayoutNode, fn: (p: PaneNode) => LayoutNode | null): LayoutNode | null {
  if (root.type === 'pane') return fn(root);
  const children = root.children.map((c) => mapPanes(c, fn));
  return { ...root, children: children as LayoutNode[] }; // nulls removed by normalize
}

const normSizes = (sizes: readonly number[]): number[] => {
  const valid = sizes.map((s) => (Number.isFinite(s) && s > 0 ? s : 0));
  const sum = valid.reduce((a, b) => a + b, 0);
  return sum > 0 && valid.every((s) => s > 0)
    ? valid.map((s) => s / sum)
    : valid.map(() => 1 / valid.length);
};

export const unzoomed = ({ zoom: _, ...p }: PaneNode): PaneNode => p;
const folded = (n: LayoutNode): boolean => n.type === 'pane' && n.zoom === 'min';

/** A lone tile is neither filled nor folded, one tile at most fills the workspace (the first), and a split never
 * holds only folded tiles (its first one opens again). */
function settle(root: LayoutNode): LayoutNode {
  if (root.type === 'pane') return root.zoom ? unzoomed(root) : root;
  let max = false;
  const walk = (n: LayoutNode): LayoutNode => {
    if (n.type === 'pane') {
      if (n.zoom !== 'max') return n;
      if (max) return unzoomed(n);
      max = true;
      return n;
    }
    const kids = n.children.map(walk);
    if (kids.every(folded)) kids[0] = unzoomed(kids[0] as PaneNode);
    return { ...n, children: kids };
  };
  return walk(root);
}

/** Removes empty panes/splits, flattens same-direction nesting, fixes sizes, active tabs and zoom. */
export function normalize(node: LayoutNode | null): LayoutNode | null {
  const n = tidy(node);
  return n && settle(n);
}

function tidy(node: LayoutNode | null): LayoutNode | null {
  if (!node) return null;
  if (node.type === 'pane') {
    const tabs = [...new Set(node.tabs)];
    if (!tabs.length) return null;
    return {
      ...node,
      tabs,
      active: tabs.includes(node.active) ? node.active : (tabs[0] as ViewId),
    };
  }
  const kids: LayoutNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((child, i) => {
    const n = tidy(child);
    const size = node.sizes[i] ?? 0;
    if (!n) return;
    if (n.type === 'split' && n.dir === node.dir) {
      n.children.forEach((c, j) => kids.push(c) && sizes.push(size * (n.sizes[j] ?? 0)));
    } else kids.push(n) && sizes.push(size);
  });
  if (!kids.length) return null;
  if (kids.length === 1) return kids[0] as LayoutNode;
  return { ...node, children: kids, sizes: normSizes(sizes) };
}

/** Keep only known views, each at most once (first occurrence wins). */
export function retainViews(root: LayoutNode, known: Pick<Set<ViewId>, 'has'>): LayoutNode | null {
  const used = new Set<ViewId>();
  return normalize(
    mapPanes(root, (p) => {
      const tabs = p.tabs.filter((t) => known.has(t) && !used.has(t) && used.add(t));
      return { ...p, tabs };
    }),
  );
}

/** Swaps one tab for another in place (the New tab page becoming the chosen view). */
export function replaceView(root: LayoutNode, old: ViewId, next: ViewId): LayoutNode {
  const swap = (p: PaneNode): PaneNode => ({
    ...p,
    tabs: p.tabs.map((t) => (t === old ? next : t)),
    active: p.active === old ? next : p.active,
  });
  return normalize(mapPanes(root, swap)) ?? root;
}

export function activate(root: LayoutNode, view: ViewId): LayoutNode {
  return mapPanes(root, (p) => (p.tabs.includes(view) ? { ...p, active: view } : p)) as LayoutNode;
}

export function removeView(root: LayoutNode, view: ViewId): LayoutNode | null {
  return normalize(mapPanes(root, (p) => ({ ...p, tabs: p.tabs.filter((t) => t !== view) })));
}

/** A joining pane takes 1/n, given up by the siblings at least that large: 1:1 → 1:1:1, the guide keeps its size. */
function insertEqual(s: SplitNode, at: number, fresh: PaneNode): SplitNode {
  const share = 1 / (s.children.length + 1);
  const donors = s.sizes.reduce((sum, z) => sum + (z >= share ? z : 0), 0);
  const sizes = s.sizes.map((z) => (z >= share ? z - (share * z) / donors : z));
  return {
    ...s,
    children: [...s.children.slice(0, at), fresh, ...s.children.slice(at)],
    sizes: [...sizes.slice(0, at), share, ...sizes.slice(at)],
  };
}

function splitPane(node: LayoutNode, paneId: string, fresh: PaneNode, zone: Zone): LayoutNode {
  const dir: Dir = zone === 'left' || zone === 'right' ? 'row' : 'col';
  const after = zone === 'right' || zone === 'bottom' ? 1 : 0;
  if (node.type === 'pane')
    return node.id !== paneId ? node : split(dir, after ? [node, fresh] : [fresh, node]);
  const i = node.children.findIndex((c) => c.type === 'pane' && c.id === paneId);
  if (i >= 0 && node.dir === dir) return insertEqual(node, i + after, fresh);
  return { ...node, children: node.children.map((c) => splitPane(c, paneId, fresh, zone)) };
}

/** A tile that a tab arrives in opens if it was folded. */
const opened = (p: PaneNode): PaneNode => (p.zoom === 'min' ? unzoomed(p) : p);
/** A new tile is to be seen: no tile fills the workspace any more. */
const unfilled = (root: LayoutNode): LayoutNode =>
  mapPanes(root, (p) => (p.zoom === 'max' ? unzoomed(p) : p)) as LayoutNode;

export function addView(root: LayoutNode, paneId: string, view: ViewId, zone: Zone): LayoutNode {
  if (zone !== 'center')
    return normalize(unfilled(splitPane(root, paneId, pane([view]), zone))) ?? root;
  const add = (p: PaneNode): PaneNode =>
    p.id === paneId ? { ...opened(p), tabs: [...p.tabs, view], active: view } : p;
  return normalize(mapPanes(root, add)) ?? root;
}

/** Moves a tab. `index` (center only) inserts at that position of the target strip, enabling reorder. */
export function moveView(
  root: LayoutNode,
  view: ViewId,
  paneId: string,
  zone: Zone,
  index?: number,
): LayoutNode {
  const src = paneOfView(root, view);
  if (zone === 'center' && index !== undefined) {
    const target = panes(root).find((p) => p.id === paneId);
    if (!target) return root;
    const from = target.tabs.indexOf(view);
    const at = from >= 0 && from < index ? index - 1 : index;
    const next = mapPanes(root, (p) => {
      const tabs = p.tabs.filter((t) => t !== view);
      if (p.id !== paneId) return { ...p, tabs };
      tabs.splice(Math.max(0, Math.min(at, tabs.length)), 0, view);
      return { ...(from >= 0 ? p : opened(p)), tabs, active: view };
    });
    return normalize(next) ?? root;
  }
  if (src?.id === paneId && (zone === 'center' || src.tabs.length === 1))
    return activate(root, view);
  const removed = src ? removeView(root, view) : root;
  if (!removed || !panes(removed).some((p) => p.id === paneId)) return root;
  return addView(removed, paneId, view, zone);
}

/** New sizes for a split. Beside a folded tile they share out the open tiles' room: the folded one keeps its share. */
export function resize(root: LayoutNode, splitId: string, sizes: readonly number[]): LayoutNode {
  if (root.type === 'pane') return root;
  if (root.id === splitId && sizes.length === root.children.length) {
    const open = root.children.map((c) => !folded(c));
    const sum = (list: readonly number[]): number =>
      list.reduce((all, z, i) => all + (open[i] ? z : 0), 0);
    const [share, given] = [sum(root.sizes), sum(sizes)];
    if (open.every(Boolean) || !(given > 0)) return { ...root, sizes: normSizes(sizes) };
    const next = sizes.map((z, i) => (open[i] ? (z / given) * share : (root.sizes[i] ?? 0)));
    return { ...root, sizes: normSizes(next) };
  }
  return { ...root, children: root.children.map((c) => resize(c, splitId, sizes)) };
}

export function closePane(root: LayoutNode, paneId: string): LayoutNode | null {
  return normalize(mapPanes(root, (p) => (p.id === paneId ? null : p)));
}

export function views(root: LayoutNode): ViewId[] {
  return panes(root).flatMap((p) => p.tabs);
}

/** The item `dir` steps from `at`, wrapping. */
export const step = <T>(list: readonly T[], at: number, dir: number): T | undefined =>
  list[(at + dir + list.length) % list.length];

/** The tile after (1) or before (-1) `paneId` in reading order, wrapping. */
export function beside(
  root: LayoutNode,
  paneId: string | undefined,
  dir: number,
): PaneNode | undefined {
  const all = panes(root);
  const at = all.findIndex((p) => p.id === paneId);
  return step(all, at, dir);
}

/** The tile that fills the workspace, if one does. */
export const filled = (root: LayoutNode): PaneNode | undefined =>
  panes(root).find((p) => p.zoom === 'max');

function parentOf(node: LayoutNode, id: string): SplitNode | undefined {
  if (node.type === 'pane') return undefined;
  if (node.children.some((c) => c.id === id)) return node;
  return node.children.map((c) => parentOf(c, id)).find(Boolean);
}

/** A tile folds only beside a sibling that stays open to take its room. */
export function canFold(root: LayoutNode, paneId: string): boolean {
  const parent = parentOf(root, paneId);
  return Boolean(parent?.children.some((c) => c.id !== paneId && !folded(c)));
}

/** Fills the workspace with a tile (ending any other's), folds it, or (`undefined`) gives it its place again. */
export function zoomPane(root: LayoutNode, paneId: string, zoom?: Zoom): LayoutNode {
  if (zoom === 'min' && !canFold(root, paneId)) return root;
  const set = (p: PaneNode): PaneNode => {
    if (p.id === paneId) return zoom ? { ...p, zoom } : unzoomed(p);
    return zoom === 'max' && p.zoom === 'max' ? unzoomed(p) : p;
  };
  return normalize(mapPanes(root, set)) ?? root;
}

/** A tab brought to the front is seen: its tile opens if folded, and while a tile fills the workspace, its tile fills
 * it instead. The same layout (`root` itself) when it is already so. */
export function front(root: LayoutNode, view: ViewId): LayoutNode {
  const p = paneOfView(root, view);
  const max = filled(root);
  if (!p || (p.active === view && p.zoom !== 'min' && (!max || max.id === p.id))) return root;
  const next = activate(root, view);
  return max ? zoomPane(next, p.id, 'max') : p.zoom === 'min' ? zoomPane(next, p.id) : next;
}
