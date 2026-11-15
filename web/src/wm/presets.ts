// Default layouts. Two layout families of nine workspaces each: `main` is the reader's own once signed in, `guest`
// is what a visitor reads in while signed out. Signing in shows `main` and signing out shows `guest` again; each
// keeps what was arranged in it. Both start from the same arrangement, which is also what "reset layout" gives.
import { NEW_TAB } from './launcher.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const FAMILY = 'main';
export const GUEST = 'guest';
/** The family for who is reading: an account's own, or the visitor's. */
export const familyOf = (signedIn: boolean): string => (signedIn ? FAMILY : GUEST);

/** Workspace 1, for a visitor and a reader alike: Global and Home at the left; at the right the composer over
 * Accounts, Notifications and Settings. What is in front fits who reads: a visitor starts on Global with the way
 * in beside it, a reader on Home with their notifications. A window too narrow for two columns gets one tile. */
export function homePreset(width = globalThis.innerWidth || 1440, family = FAMILY): LayoutNode {
  const guest = family === GUEST;
  const read = ['global', 'home'];
  const own = ['account', 'notifications', 'settings'];
  const front = guest ? 'global' : 'home';
  if (width < 760) return pane([...read, 'compose', ...own], front);
  return split(
    'row',
    [
      pane(read, front),
      split(
        'col',
        [pane(['compose']), pane(own, guest ? 'account' : 'notifications')],
        [0.34, 0.66],
      ),
    ],
    width < 1200 ? [0.56, 0.44] : [0.6, 0.4],
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
