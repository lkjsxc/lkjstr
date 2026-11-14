// View registry: every kind of tab a pane can show.
import type { Engine } from '../engine/client.ts';
import type { Key } from '../shared/i18n.ts';
import type { SettingsStore } from '../shared/settings.ts';
import type { Disposer, Signal } from '../shared/signal.ts';
import { mountCompose } from './compose.ts';
import { mountFeed } from './feed.ts';
import { mountSettings } from './settings.ts';

export type OpenOpts = { readonly split?: boolean; readonly background?: boolean };
export type ViewEnv = {
  readonly engine: Engine;
  readonly settings: SettingsStore;
  /** The overlay layer menus open in. */
  readonly layer: HTMLElement;
  /** Unique name of this tab: the key of its saved state (`shared/view-state.ts`). */
  readonly instance: string;
  /** Renames this tab. */
  readonly setTitle: (title: string) => void;
  /** Whether the tab is in front (its element is on screen). */
  readonly visible: Pick<Signal<boolean>, 'get' | 'subscribe'>;
  /** Opens another tab in the same tile, right after this one, and focuses it (`split`: in a new tile beside it). */
  readonly open: (kind: string, state?: object, opts?: OpenOpts) => void;
  /** Closes this tab. */
  readonly close: () => void;
  /** Forgets every saved layout. */
  readonly resetLayouts: () => void;
};
export type ViewDef = {
  readonly id: string;
  readonly title: Key;
  /** One line for the New tab page. */
  readonly hint: Key;
  /** Offered on the New tab page (a thread or a profile needs something to show first). */
  readonly launch: boolean;
  /** Extra words the New tab page's filter matches. */
  readonly aliases?: string;
  readonly mount: (el: HTMLElement, env: ViewEnv) => Disposer;
};

const feed = (id: string, launch = true, aliases = ''): ViewDef => ({
  id,
  title: `view.${id}` as Key,
  hint: `view.${id}.hint` as Key,
  launch,
  aliases,
  mount: (el, env) => mountFeed(el, env, id),
});

export const VIEWS: readonly ViewDef[] = [
  feed('home', true, 'timeline tl タイムライン フォロー'),
  feed('global', true, 'public firehose 全体'),
  feed('notifications', true, 'mentions replies 返信 メンション'),
  feed('bookmarks', true, 'saved 保存'),
  feed('search', true, 'find 探す'),
  feed('hashtag', false),
  feed('thread', false),
  feed('profile', false),
  feed('following', false),
  feed('followers', false),
  {
    id: 'compose',
    title: 'view.compose',
    hint: 'view.compose.hint',
    launch: true,
    aliases: 'post write new note 書く',
    mount: mountCompose,
  },
  {
    id: 'settings',
    title: 'view.settings',
    hint: 'view.settings.hint',
    launch: true,
    aliases: 'options preferences config 環境設定',
    mount: mountSettings,
  },
];

/** Tab ids are `<view id>` or `<view id>~<n>`: every view can be open several times. */
export const kindOf = (tab: string): string => tab.split('~')[0] ?? tab;
const BY_ID: ReadonlyMap<string, ViewDef> = new Map(VIEWS.map((v) => [v.id, v]));
export const viewOf = (tab: string): ViewDef | undefined => BY_ID.get(kindOf(tab));
/** First free tab id for another instance of `kind`. */
export function freshTab(kind: string, used: ReadonlySet<string>): string {
  if (!used.has(kind)) return kind;
  for (let n = 2; ; n++) if (!used.has(`${kind}~${n}`)) return `${kind}~${n}`;
}
