// View registry: every kind of tab a pane can show.
import type { Engine } from '../engine/client.ts';
import type { NoteRow } from '../engine/protocol.ts';
import type { Key } from '../shared/i18n.ts';
import type { SettingsStore } from '../shared/settings.ts';
import type { Disposer, Signal } from '../shared/signal.ts';
import type { MenuItem } from '../wm/menus.ts';
import { mountAccount } from './account.ts';
import { CHANNELS_SINCE } from './channel-parts.ts';
import { mountChannels } from './channels.ts';
import { mountCompose } from './compose.ts';
import { mountDocs } from './docs.ts';
import { mountFeed } from './feed.ts';
import { gated } from './gated.ts';
import { mountMedia } from './media.ts';
import { mountMessage } from './message.ts';
import { mountMessages } from './messages.ts';
import { mountRelays } from './relays.ts';
import { mountSettings } from './settings.ts';
import { mountStats } from './stats.ts';

export type OpenOpts = {
  readonly split?: boolean;
  readonly background?: boolean;
  /** In the neighbouring tile (the same one when it is the only tile), so what was being read stays in view. */
  readonly beside?: boolean;
  /** What gets the keyboard back when the opened tab closes. */
  readonly from?: HTMLElement;
};
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
  /** What this tab adds to its tile's "…" menu, asked each time the menu opens. */
  readonly menu: (items: () => readonly MenuItem[]) => void;
  /** Puts this workspace back to its default arrangement, with Undo (`every`: all saved layouts, without). */
  readonly resetLayouts: (every: boolean) => void;
  /** A reply pressed on a note: true when this tab answers it itself (a thread's own field). */
  readonly reply?: (row: NoteRow) => boolean;
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
  /** The protocol version the engine must speak for this view to be offered. */
  readonly since?: number;
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
  {
    ...feed('their-home', false),
    since: 5,
    mount: gated(5, 'home.unsupported', (el, env) => mountFeed(el, env, 'their-home')),
  },
  feed('global', true, 'public firehose 全体'),
  feed('notifications', true, 'mentions replies 返信 メンション'),
  feed('bookmarks', true, 'saved 保存'),
  {
    id: 'messages',
    title: 'view.messages',
    hint: 'view.messages.hint',
    launch: true,
    since: 6,
    mount: gated(6, 'dm.unsupported', mountMessages),
  },
  {
    id: 'message',
    title: 'dm.message',
    hint: 'view.message.hint',
    launch: false,
    since: 6,
    mount: gated(6, 'dm.unsupported', mountMessage),
  },
  feed('search', true, 'find 探す'),
  feed('hashtag', false),
  feed('thread', false),
  feed('profile', false),
  feed('following', false),
  feed('followers', false),
  {
    id: 'channels',
    title: 'view.channels',
    hint: 'view.channels.hint',
    launch: true,
    aliases: 'chat rooms public nip28 チャット 部屋 ルーム',
    since: CHANNELS_SINCE,
    mount: gated(CHANNELS_SINCE, 'channel.unsupported', mountChannels),
  },
  {
    ...feed('channel', false),
    mount: gated(CHANNELS_SINCE, 'channel.unsupported', (el, env) => mountFeed(el, env, 'channel')),
  },
  {
    id: 'media',
    title: 'view.media',
    hint: 'view.media.hint',
    launch: false,
    mount: mountMedia,
  },
  {
    id: 'compose',
    title: 'view.compose',
    hint: 'view.compose.hint',
    launch: true,
    aliases: 'post write new note compose 書く ノート',
    mount: mountCompose,
  },
  {
    id: 'account',
    title: 'view.account',
    hint: 'view.account.hint',
    launch: true,
    aliases:
      'sign in login log in signin nsec npub key bunker extension ログイン サインイン 鍵 切り替え',
    mount: mountAccount,
  },
  {
    id: 'settings',
    title: 'view.settings',
    hint: 'view.settings.hint',
    launch: true,
    aliases: 'options preferences config 環境設定',
    mount: mountSettings,
  },
  {
    id: 'relays',
    title: 'view.relays',
    hint: 'view.relays.hint',
    launch: true,
    aliases: 'servers connections network nip65 接続 サーバー',
    mount: mountRelays,
  },
  {
    id: 'stats',
    title: 'view.stats',
    hint: 'view.stats.hint',
    launch: true,
    aliases: 'statistics metrics numbers health cache network 状態 数字 キャッシュ',
    mount: mountStats,
  },
  {
    id: 'docs',
    title: 'view.docs',
    hint: 'view.docs.hint',
    launch: true,
    // Its pages are found by their own names (`wm/choices.ts`).
    aliases: 'help manual guide documentation ヘルプ 使い方 説明',
    mount: mountDocs,
  },
];

/** What the engine said it speaks (0 until it has): a view it cannot serve is not offered anywhere. */
let served = 0;
export const setServed = (version: number): void => void (served = version);
export const serves = (since: number): boolean => served >= since;
export const offered = (v: ViewDef): boolean => v.launch && (v.since ?? 0) <= served;

/** Tab ids are `<view id>` or `<view id>~<n>`: every view can be open several times. */
export const kindOf = (tab: string): string => tab.split('~')[0] ?? tab;
const BY_ID: ReadonlyMap<string, ViewDef> = new Map(VIEWS.map((v) => [v.id, v]));
export const viewOf = (tab: string): ViewDef | undefined => BY_ID.get(kindOf(tab));
/** First free tab id for another instance of `kind`. */
export function freshTab(kind: string, used: ReadonlySet<string>): string {
  if (!used.has(kind)) return kind;
  for (let n = 2; ; n++) if (!used.has(`${kind}~${n}`)) return `${kind}~${n}`;
}
