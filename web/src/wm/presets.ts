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
/** The reader's Home in the phone default. A phone has no Notifications tab, so notifications flow into this Home from
 * the start (its filter's "Notifications: Show"; owner, 2026-11-22). An id of its own, so a reset gives it back so. */
export const PHONE_HOME = 'home~news';
/** What a tab of a default layout holds before anything is stored for it (own-views.ts puts it there). */
export const startState = (tab: string): Record<string, unknown> | undefined =>
  tab === LKJSXC_HOME
    ? { pubkey: LKJSXC, title: t('home.theirs', { name: 'lkjsxc' }) }
    : tab === PHONE_HOME
      ? { filter: { news: true } }
      : undefined;

/** Workspace 1, for a visitor and a reader alike: at the left Home with lkjsxc's Home behind it; in the middle
 * Documentation, open at what lkjstr is, in front of Notifications, so that is read first; at the right the composer
 * over Accounts and Settings, in equal halves. A visitor, whose Home is empty, starts on lkjsxc's. Under 1200px the
 * middle tile joins the lower right one. Under 760px (owner, 2026-11-22) one tile holds the rest, over the composer
 * collapsed to its bar at the bottom; there is no Notifications tab, since they flow into the reader's Home, and a
 * visitor starts on Documentation, a reader on Home. */
export function homePreset(width = globalThis.innerWidth || 1440, family = FAMILY): LayoutNode {
  const guest = family === GUEST;
  const read = pane(['home', LKJSXC_HOME], guest ? LKJSXC_HOME : 'home');
  const news = ['docs', 'notifications'];
  const own = ['account', 'settings'];
  if (width < 760) {
    const home = guest ? 'home' : PHONE_HOME;
    const post: LayoutNode = { ...pane(['compose']), zoom: 'min' };
    return split(
      'col',
      [pane([home, LKJSXC_HOME, 'docs', ...own], guest ? 'docs' : home), post],
      [0.6, 0.4],
    );
  }
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
