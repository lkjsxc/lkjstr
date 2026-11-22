// Maximize and collapse in the layout model: what each operation does to a filled or folded tile.
import { describe, expect, it } from 'vitest';
import * as L from '../src/wm/layout.ts';
import { parseLayout } from '../src/wm/layout-parse.ts';

/** Three tiles in a row: a (two tabs), b, c. */
const three = (): L.SplitNode =>
  L.split('row', [L.pane(['a1', 'a2']), L.pane(['b']), L.pane(['c'])], [0.4, 0.3, 0.3]);
const tile = (root: L.LayoutNode, view: string): L.PaneNode =>
  L.paneOfView(root, view) as L.PaneNode;
const zooms = (root: L.LayoutNode): (L.Zoom | '')[] => L.panes(root).map((p) => p.zoom ?? '');
const json = (root: L.LayoutNode): unknown => JSON.parse(JSON.stringify(root));

describe('maximize', () => {
  it('one tile at most fills the workspace; filling another moves it', () => {
    let root: L.LayoutNode = three();
    root = L.zoomPane(root, tile(root, 'a1').id, 'max');
    expect(zooms(root)).toEqual(['max', '', '']);
    expect(L.filled(root)?.tabs).toEqual(['a1', 'a2']);
    root = L.zoomPane(root, tile(root, 'c').id, 'max');
    expect(zooms(root)).toEqual(['', '', 'max']);
    root = L.zoomPane(root, tile(root, 'c').id);
    expect(L.filled(root)).toBeUndefined();
    expect((root as L.SplitNode).sizes).toEqual([0.4, 0.3, 0.3]);
  });
  it('a lone tile is neither filled nor folded', () => {
    const lone = L.pane(['a']);
    expect(L.zoomPane(lone, lone.id, 'max')).toEqual({ ...lone });
    expect(L.canFold(lone, lone.id)).toBe(false);
    expect(L.zoomPane(lone, lone.id, 'min')).toBe(lone);
  });
  it('closing the last tab of the filled tile shows the other tiles again', () => {
    let root: L.LayoutNode | null = three();
    root = L.zoomPane(root, tile(root, 'b').id, 'max');
    root = L.removeView(root, 'b');
    expect(root && L.filled(root)).toBeUndefined();
    expect(root && L.views(root)).toEqual(['a1', 'a2', 'c']);
  });
  it('a tab closed from the filled tile keeps the tile filled while it has tabs', () => {
    let root: L.LayoutNode | null = three();
    root = L.zoomPane(root, tile(root, 'a1').id, 'max');
    root = L.removeView(root, 'a1');
    expect(root && L.filled(root)?.tabs).toEqual(['a2']);
  });
  it('a split made from the filled tile shows every tile, the new one with them', () => {
    let root: L.LayoutNode = three();
    root = L.zoomPane(root, tile(root, 'a1').id, 'max');
    const moved = L.moveView(root, 'a2', tile(root, 'a1').id, 'right');
    expect(L.filled(moved)).toBeUndefined();
    expect(L.panes(moved).map((p) => p.tabs.join())).toEqual(['a1', 'a2', 'b', 'c']);
    const added = L.addView(root, tile(root, 'a1').id, 'd', 'bottom');
    expect(L.filled(added)).toBeUndefined();
  });
  it('reordering tabs inside the filled tile keeps it filled', () => {
    let root: L.LayoutNode = three();
    const a = tile(root, 'a1').id;
    root = L.zoomPane(root, a, 'max');
    root = L.moveView(root, 'a2', a, 'center', 0);
    expect(tile(root, 'a1').tabs).toEqual(['a2', 'a1']);
    expect(L.filled(root)?.id).toBe(a);
  });
});

describe('collapse', () => {
  it('a tile folds beside an open sibling and keeps its share for when it opens', () => {
    let root: L.LayoutNode = three();
    const b = tile(root, 'b').id;
    expect(L.canFold(root, b)).toBe(true);
    root = L.zoomPane(root, b, 'min');
    expect(zooms(root)).toEqual(['', 'min', '']);
    // As drawn, the open tiles share all the room (0.4 and 0.3 of 0.7); a resize gives them 0.6 and 0.4 of it.
    root = L.resize(root, root.id, [0.6, 0.3, 0.4]);
    expect((root as L.SplitNode).sizes.map((z) => Math.round(z * 100))).toEqual([42, 30, 28]);
    root = L.zoomPane(root, b);
    expect(zooms(root)).toEqual(['', '', '']);
    expect((root as L.SplitNode).sizes.map((z) => Math.round(z * 100))).toEqual([42, 30, 28]);
  });
  it('the last open tile of a split cannot fold', () => {
    let root: L.LayoutNode = three();
    root = L.zoomPane(root, tile(root, 'a1').id, 'min');
    root = L.zoomPane(root, tile(root, 'b').id, 'min');
    const c = tile(root, 'c').id;
    expect(L.canFold(root, c)).toBe(false);
    expect(L.zoomPane(root, c, 'min')).toBe(root);
  });
  it('a split that would hold only folded tiles opens its first one', () => {
    let root: L.LayoutNode | null = three();
    root = L.zoomPane(root, tile(root, 'a1').id, 'min');
    root = L.zoomPane(root, tile(root, 'b').id, 'min');
    root = L.removeView(root, 'c');
    expect(root && zooms(root)).toEqual(['', 'min']);
  });
  it('a nested split counts as open, so a tile folds beside it', () => {
    const root = L.split('row', [L.pane(['a']), L.split('col', [L.pane(['b']), L.pane(['c'])])]);
    const folded = L.zoomPane(root, tile(root, 'a').id, 'min');
    expect(zooms(folded)).toEqual(['min', '', '']);
    expect(L.canFold(folded, tile(folded, 'b').id)).toBe(true);
  });
  it('a tab dropped or opened into a folded tile opens it', () => {
    let root: L.LayoutNode = three();
    const b = tile(root, 'b').id;
    root = L.zoomPane(root, b, 'min');
    expect(zooms(L.moveView(root, 'c', b, 'center', 0))).toEqual(['', '']);
    expect(zooms(L.moveView(root, 'a2', b, 'center'))).toEqual(['', '', '']);
    expect(zooms(L.addView(root, b, 'd', 'center'))).toEqual(['', '', '']);
  });
  it('a tab moved within a folded tile, or out of it, leaves it folded', () => {
    let root: L.LayoutNode = L.split('row', [L.pane(['a']), L.pane(['b1', 'b2'])]);
    const b = tile(root, 'b1').id;
    root = L.zoomPane(root, b, 'min');
    expect(tile(L.moveView(root, 'b2', b, 'center', 0), 'b1').zoom).toBe('min');
    const out = L.moveView(root, 'b2', tile(root, 'a').id, 'center');
    expect(tile(out, 'b1').zoom).toBe('min');
  });
  it('a maximized tile that folds shows the others again', () => {
    let root: L.LayoutNode = three();
    const a = tile(root, 'a1').id;
    root = L.zoomPane(root, a, 'max');
    root = L.zoomPane(root, a, 'min');
    expect(zooms(root)).toEqual(['min', '', '']);
  });
});

describe('bringing a tab to the front', () => {
  it('opens its folded tile', () => {
    let root: L.LayoutNode = three();
    root = L.zoomPane(root, tile(root, 'a1').id, 'min');
    const next = L.front(root, 'a2');
    expect(tile(next, 'a2').active).toBe('a2');
    expect(zooms(next)).toEqual(['', '', '']);
  });
  it('while a tile fills the workspace, fills it with the tab’s tile instead', () => {
    let root: L.LayoutNode = three();
    root = L.zoomPane(root, tile(root, 'a1').id, 'max');
    expect(zooms(L.front(root, 'c'))).toEqual(['', '', 'max']);
  });
  it('changes nothing when the tab is already in front and in view', () => {
    const root = three();
    expect(L.front(root, 'b')).toBe(root);
    expect(L.front(root, 'missing')).toBe(root);
    expect(L.front(root, 'a2')).not.toBe(root);
  });
});

describe('stored zoom', () => {
  it('round-trips and refuses what it does not know', () => {
    let root: L.LayoutNode = three();
    root = L.zoomPane(root, tile(root, 'b').id, 'min');
    root = L.zoomPane(root, tile(root, 'c').id, 'max');
    expect(parseLayout(json(root))).toEqual(json(root));
    const odd = { type: 'pane', id: 'x', tabs: ['a'], active: 'a', zoom: 'huge' };
    expect(parseLayout(odd)).toEqual({ type: 'pane', id: 'x', tabs: ['a'], active: 'a' });
  });
  it('an unzoomed tile stores no zoom at all', () => {
    let root: L.LayoutNode = three();
    root = L.zoomPane(root, tile(root, 'b').id, 'min');
    root = L.zoomPane(root, tile(root, 'b').id);
    expect(JSON.stringify(root)).not.toContain('zoom');
  });
});

describe('stepping between tiles', () => {
  it('wraps in reading order', () => {
    const root = three();
    const [a, b, c] = L.panes(root);
    expect(L.beside(root, a?.id, 1)?.id).toBe(b?.id);
    expect(L.beside(root, a?.id, -1)?.id).toBe(c?.id);
    expect(L.step(['x', 'y'], 1, 1)).toBe('x');
  });
});
