// Default layouts. Two layout families of nine workspaces each: `main` is the reader's own once signed in, `guest`
// is what a visitor reads in while signed out. Signing in shows `main` and signing out shows `guest` again; each
// keeps what was arranged in it. Both start from the same arrangement, which is also what "reset layout" gives.
import { t } from '../shared/i18n.ts';
import { NEW_TAB } from './launcher.ts';
import { type LayoutNode, pane, split } from './layout.ts';

export const FAMILY = 'main';
export const GUEST = 'guest';
/** The family for who is reading: an account's own, or the visitor's. */
export const familyOf = (signedIn: boolean): string => (signedIn ? FAMILY : GUEST);

/** lkjsxc, who makes lkjstr (owner, 2026-11-22: show my timeline in place of Global). The key behind the NIP-05
 * address lkjsxc@lkjsxc.com, checked that day against its kind 0 (name lkjsxc, the same address) on two relays. */
export const LKJSXC = '040abd2000fac6d8e996693064edb89d58e132dfe553d295e36dff829e92cb38';
/** The default's tab of lkjsxc's Home: the notes of the people lkjsxc follows. An id of its own, so a reset gives it
 * back even beside a Their Home the reader opened for someone else. */
export const LKJSXC_HOME = 'their-home~lkjsxc';
/** What a tab of a default layout holds before anything is stored for it (own-views.ts puts it there). */
export const startState = (tab: string): { pubkey: string; title: string } | undefined =>
  tab === LKJSXC_HOME ? { pubkey: LKJSXC, title: t('home.theirs', { name: 'lkjsxc' }) } : undefined;

/** Workspace 1, for a visitor and a reader alike: at the left Home with lkjsxc's Home behind it; in the middle
 * Documentation, open at what lkjstr is, in front of Notifications, so that is read first; at the right the composer
 * over Accounts and Settings, in equal halves. A visitor, whose Home is empty, starts on lkjsxc's. Under 1200px the
 * middle tile joins the lower right one; under 760px everything is one tile, where a visitor starts on
 * Documentation and a reader on Home. */
export function homePreset(width = globalThis.innerWidth || 1440, family = FAMILY): LayoutNode {
  const guest = family === GUEST;
  const read = pane(['home', LKJSXC_HOME], guest ? LKJSXC_HOME : 'home');
  const news = ['docs', 'notifications'];
  const own = ['account', 'settings'];
  if (width < 760) return pane([...read.tabs, ...news, 'compose', ...own], guest ? 'docs' : 'home');
  if (width < 1200)
    return split(
      'row',
      [read, split('col', [pane(['compose']), pane([...news, ...own])], [0.5, 0.5])],
      [0.56, 0.44],
    );
  return split(
    'row',
    [read, pane(news), split('col', [pane(['compose']), pane(own, 'account')], [0.5, 0.5])],
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
