// What can be done with a note: the icon row (reply, repost or quote, like, zap, then any emoji, bookmark, more) and
// under it the reaction chips, so the row never moves when the first reaction arrives. Every action shows at once (the engine patches the row) and reports a failure in words.
import type { ActResult } from '../engine/client.ts';
import type { Action, NoteRow } from '../engine/protocol.ts';
import { isEmojiGrapheme } from '../shared/emoji-text.ts';
import { countText } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { LKJSTR_ORIGIN } from '../shared/nostr-link.ts';
import { groupReactions } from '../shared/reactions.ts';
import { type MenuItem, openMenu } from '../wm/menus.ts';
import { ability, abilityText, able } from './can.ts';
import type { Quoted } from './compose-context.ts';
import { openEmojiPicker } from './emoji-picker.ts';
import { type HeldWhat, hold, unhold } from './held.ts';
import { copy, emojiImg, nameText, plainName, toast, unicodeEmoji } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const DEFAULT_REACTION = '❤️';

const failed = (env: ViewEnv, r: ActResult): void => {
  if (r.ok) return;
  const key = `error.${r.error?.code ?? 'internal'}`;
  toast(env.layer, `${t(key as Key)}${r.error?.message ? `: ${r.error.message}` : ''}`);
};
/** Sends an action as the active account; says so when it could not be done. */
export async function act(env: ViewEnv, make: (as: string) => Action): Promise<boolean> {
  if (!able(env)) return false;
  const as = env.engine.me();
  const r = await env.engine.act(make(as));
  failed(env, r);
  return r.ok;
}
/** A like or a repost: shown at once, sent when its Undo is gone (`held.ts`), so Undo means it was never sent. */
function later(env: ViewEnv, row: NoteRow, what: HeldWhat, said: string): void {
  if (!able(env)) return;
  const as = env.engine.me();
  hold(
    row.id,
    as,
    what,
    (a) => env.engine.act(a),
    (r) => failed(env, r),
  );
  toast(env.layer, said, () => void unhold(row.id, what));
}
function react(
  env: ViewEnv,
  row: NoteRow,
  emoji: string,
  url: string | undefined,
  on: boolean,
  address?: string,
  set?: string,
): void {
  const what: HeldWhat = {
    k: 'reaction',
    emoji,
    url,
    ...(url && address ? { address } : {}),
    ...(url && set ? { set } : {}),
  };
  if (on)
    return later(
      env,
      row,
      what,
      t('undo.reacted', { emoji: url ? `:${emoji.replace(/:/g, '')}:` : emoji }),
    );
  if (unhold(row.id, what)) return;
  void act(env, (as) => ({
    a: 'publish',
    as,
    // The picture says which of two reactions with one code is meant ('' for a Unicode one).
    what: { k: 'delete', id: row.id, of: 'reaction', emoji, url: url ?? '' },
  }));
}

// Act faces and their exact publication targets remain held until S6.
const readOnlyAct = (row: NoteRow): boolean =>
  row.eventKind !== undefined && [6, 7, 16, 9735].includes(row.eventKind);

export function reactionChips(row: NoteRow, env: ViewEnv): HTMLElement | null {
  if (readOnlyAct(row) || !row.reactions.length) return null;
  return h(
    'div',
    { class: 'chips' },
    groupReactions(row.reactions).map((r) =>
      h(
        'button',
        {
          class: r.mine ? 'rchip on' : 'rchip',
          // An emoji says what it is in its popover; a reaction written as words keeps them in a tooltip.
          title: r.url || isEmojiGrapheme(r.emoji) ? null : r.emoji,
          'data-emoji': r.emoji,
          'data-emoji-url': r.url ?? '',
          'aria-pressed': r.mine,
          onclick: (e) => (
            e.stopPropagation(), react(env, row, r.emoji, r.url, !r.mine, r.address, r.set)
          ),
        },
        r.url ? emojiImg(r.emoji, r.url, false, r) : unicodeEmoji(r.emoji),
        h('span', null, countText(r.count, row.counts.partial, getLang())),
      ),
    ),
  );
}

/** `chips`: whether reaction chips are drawn under the row; without them (a compact note above a thread's focus) the
 * heart carries the total. */
export function actionRow(row: NoteRow, env: ViewEnv, chips = true): HTMLElement | null {
  if (readOnlyAct(row)) return null;
  const lang = getLang();
  const n = (v: number): string => (v ? countText(v, row.counts.partial, lang) : '');
  // Signed out or read-only: what would publish is drawn off and says why; the counts stay readable.
  const can = ability(env.engine);
  const off = can !== 'ok';
  const button = (
    name: IconName,
    label: Key,
    count: string,
    on: boolean,
    run: (el: HTMLElement) => void,
    writes = true,
  ): HTMLElement => {
    const dead = off && writes;
    const el: HTMLElement = h(
      'button',
      {
        class: `act a-${name}${on ? ' on' : ''}${dead ? ' off' : ''}`,
        title: dead ? `${t(label)}: ${abilityText(can)}` : t(label),
        'aria-label': t(label),
        'aria-pressed': on,
        'aria-disabled': dead ? true : null,
      },
      icon(name),
      h('span', null, count),
    );
    el.addEventListener('click', (e) => (e.stopPropagation(), dead ? void able(env) : run(el)));
    return el;
  };
  const likes = groupReactions(row.reactions).find((r) => r.emoji === DEFAULT_REACTION && !r.url);
  const mine = likes?.mine ? likes : undefined;
  const quoteOf: Quoted = {
    author: row.author,
    at: row.at,
    text: fullText(row).slice(0, 400),
    media: row.media.length,
    ...(row.cw === undefined ? {} : { cw: row.cw }),
  };
  const quote = { quote: row.id, quoteOf };
  const publish = (what: Extract<Action, { a: 'publish' }>['what']) => () =>
    void act(env, (as) => ({ a: 'publish', as, what }));
  // A narrow tile folds the bookmark (unless it is set) and then the zap into the "…" menu: the row hides them by
  // the tile's width, and the menu offers whatever the row is not showing.
  const folded = (el: HTMLElement): boolean => getComputedStyle(el).display === 'none';
  const zapRun = (): void => void toast(env.layer, t('act.zapSoon'));
  const markLabel: Key = row.mine.bookmarked ? 'act.unbookmark' : 'act.bookmark';
  const marked = (on: boolean): Promise<boolean> =>
    act(env, (as) => ({ a: 'bookmark', as, id: row.id, on }));
  const markRun = async (): Promise<void> => {
    const was = row.mine.bookmarked;
    if ((await marked(!was)) && was)
      toast(env.layer, t('undo.unbookmarked'), () => void marked(true));
  };
  const unrepost = (): void =>
    void (unhold(row.id, { k: 'repost' }) || publish({ k: 'delete', id: row.id, of: 'repost' })());
  const zap = button(
    'zap',
    'act.zap',
    row.counts.zaps
      ? countText(
          row.counts.zaps,
          row.counts.partial ||
            !!row.counts.zapLimited ||
            (row.counts.zapState !== undefined && row.counts.zapState !== 'ready'),
          lang,
        )
      : '',
    false,
    zapRun,
  );
  const mark = button('bookmark', markLabel, '', row.mine.bookmarked, () => void markRun());
  return h(
    'div',
    { class: 'acts' },
    // Wherever Reply is pressed, the reply is written in the note's thread, in the field under it (a channel
    // message's reply stays in its channel); a thread answers its own focus itself.
    row.eventKind !== undefined && row.eventKind !== 30023
      ? h('span', { class: 'act a-reply', 'aria-hidden': 'true' })
      : button('reply', 'act.reply', n(row.counts.replies), false, () =>
          env.reply?.(row)
            ? undefined
            : env.open('thread', { id: row.id, title: plainName(row.author), reply: true }),
        ),
    button('repost', 'act.repost', n(row.counts.reposts), row.mine.reposted, (el) =>
      openMenu(env.layer, el, [
        row.mine.reposted
          ? { label: t('act.unrepost'), run: unrepost }
          : {
              label: t('act.repost'),
              run: () => later(env, row, { k: 'repost' }, t('undo.reposted')),
            },
        { label: t('act.quote'), run: () => env.open('compose', quote) },
      ]),
    ),
    button(
      'heart',
      'act.react',
      chips && row.reactions.length ? '' : n(row.counts.reactions),
      Boolean(mine),
      () => react(env, row, mine?.emoji ?? DEFAULT_REACTION, mine?.url, !mine),
    ),
    zap,
    // Pure actions with no count have nothing to show a reader who cannot act.
    off
      ? null
      : button('smile', 'emoji.pick', '', false, (el) =>
          openEmojiPicker(env, el, (p) => react(env, row, p.emoji, p.url, true, p.address, p.set)),
        ),
    off ? null : mark,
    button('more', 'act.more', '', false, (el) => openMenu(env.layer, el, moreItems()), false),
  );
  function moreItems(): MenuItem[] {
    return [
      ...(folded(mark) && !off ? [{ label: t(markLabel), run: () => void markRun() }] : []),
      ...(folded(zap) && !off ? [{ label: t('act.zap'), run: zapRun }] : []),
      { label: t('menu.copyText'), run: () => void copy(env, fullText(row)) },
      {
        label: t('menu.copyLink'),
        run: () => void copy(env, `${location.origin}${row.copyLink ?? `/n/${row.bech32}`}`),
      },
      ...(row.shareEvent
        ? [
            {
              label: t('menu.copyLkjstrLink'),
              run: () => void copy(env, `${LKJSTR_ORIGIN}/${row.shareEvent}`),
            },
          ]
        : []),
      { label: t('menu.copyId'), run: () => void copy(env, row.bech32) },
      {
        label: t('menu.mutePerson', { name: plainName(row.author) }),
        disabled: off,
        run: () =>
          void act(env, (as) => ({
            a: 'mute',
            as,
            target: { k: 'person', pubkey: row.author.pubkey },
            on: true,
          })),
      },
      {
        label: t('menu.muteThread'),
        disabled: off,
        run: () =>
          void act(env, (as) => ({
            a: 'mute',
            as,
            target: { k: 'thread', id: row.id },
            on: true,
          })),
      },
      ...(row.mine.own && !off
        ? [{ label: t('menu.delete'), danger: true, run: publish({ k: 'delete', id: row.id }) }]
        : []),
    ];
  }
}

const fullText = (row: NoteRow): string =>
  row.segments
    .map((s) =>
      s.k === 'text'
        ? s.text
        : s.k === 'link'
          ? s.url
          : s.k === 'hashtag'
            ? `#${s.tag}`
            : s.k === 'mention'
              ? `@${nameText(s.name)}`
              : s.k === 'emoji'
                ? `:${s.code}:`
                : s.text,
    )
    .join('');
