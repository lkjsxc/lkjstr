// Default layouts. Two layout families of nine workspaces each: `main` is the reader's own once signed in, `guest`
// is what a visitor reads in while signed out (nothing there needs an account, so no tile starts empty). Signing
// in shows `main` and signing out shows `guest` again; each keeps what was arranged in it. A tile can be any size,
// so the first workspace is chosen by the width of the window it is first drawn in.
import { NEW_TAB } from './launcher.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const FAMILY = 'main';
export const GUEST = 'guest';
/** The family for who is reading: an account's own, or the visitor's. */
export const familyOf = (signedIn: boolean): string => (signedIn ? FAMILY : GUEST);

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

export const presetOf = (space = 1, width?: number, family = FAMILY): LayoutNode =>
  family === GUEST
    ? pane([space === 1 ? 'global' : NEW_TAB])
    : space === 1
      ? homePreset(width)
      : space === 2
        ? readingPreset()
        : pane([NEW_TAB]);
