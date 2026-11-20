// Default layouts. Two layout families of nine workspaces each: `main` is the reader's own once signed in, `guest`
// is what a visitor reads in while signed out. Signing in shows `main` and signing out shows `guest` again; each
// keeps what was arranged in it. Both start from the same arrangement, which is also what "reset layout" gives.
import { NEW_TAB } from './launcher.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const FAMILY = 'main';
export const GUEST = 'guest';
/** The family for who is reading: an account's own, or the visitor's. */
export const familyOf = (signedIn: boolean): string => (signedIn ? FAMILY : GUEST);

/** Workspace 1, for a visitor and a reader alike: Home at the left, Notifications in the middle, and at the right
 * the composer over Accounts and Settings, in equal halves. Global waits behind Home; a visitor, whose Home is
 * empty, starts on it. Under 1200px Notifications joins the lower right tile; under 760px everything is one tile. */
export function homePreset(width = globalThis.innerWidth || 1440, family = FAMILY): LayoutNode {
  const read = pane(['home', 'global'], family === GUEST ? 'global' : 'home');
  const own = ['account', 'settings'];
  if (width < 760) return pane([...read.tabs, 'notifications', 'compose', ...own], read.active);
  if (width < 1200)
    return split(
      'row',
      [read, split('col', [pane(['compose']), pane(['notifications', ...own])], [0.5, 0.5])],
      [0.56, 0.44],
    );
  return split(
    'row',
    [
      read,
      pane(['notifications']),
      split('col', [pane(['compose']), pane(own, 'account')], [0.5, 0.5]),
    ],
    [0.4, 0.3, 0.3],
  );
}

/** Workspace 2: reading wide. Every other workspace starts as a New tab page. */
const readingPreset = (): LayoutNode => pane(['global', 'bookmarks']);

export const presetOf = (space = 1, width?: number, family = FAMILY): LayoutNode =>
  space === 1
    ? homePreset(width, family)
    : space === 2 && family !== GUEST
      ? readingPreset()
      : pane([NEW_TAB]);
