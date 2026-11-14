// Default layouts. lkjstr has one layout family (`main`) with nine workspaces; a tile can be any size, so the
// first workspace is chosen by the width of the window it is first drawn in.
import { NEW_TAB } from './launcher.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const FAMILY = 'main';

/** Workspace 1: Home, then Notifications over the composer, then Global beside them; fewer columns when narrow. */
export function homePreset(width = globalThis.innerWidth || 1440): LayoutNode {
  if (width < 760) return pane(['home', 'notifications', 'global', 'compose']);
  if (width < 1200)
    return split(
      'row',
      [pane(['home', 'global']), pane(['notifications', 'compose'])],
      [0.56, 0.44],
    );
  return split(
    'row',
    [
      pane(['home']),
      split('col', [pane(['notifications']), pane(['compose'])], [0.64, 0.36]),
      pane(['global', 'bookmarks']),
    ],
    [0.38, 0.28, 0.34],
  );
}

/** Workspace 2: reading wide. Every other workspace starts as a New tab page. */
const readingPreset = (): LayoutNode => pane(['global', 'bookmarks']);

export const presetOf = (space = 1, width?: number): LayoutNode =>
  space === 1 ? homePreset(width) : space === 2 ? readingPreset() : pane([NEW_TAB]);
