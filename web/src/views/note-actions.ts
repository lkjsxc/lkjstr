// What can be done with a note: the icon row (reply, repost or quote, any emoji, like, zap, bookmark, more) and
// under it the reaction chips, so the row never moves when the first reaction arrives. Every action shows at once (the engine patches the row) and reports a failure in words.
import type { Action, NoteRow } from '../engine/protocol.ts';
import { countText } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';
import { type IconName, icon } from '../shared/icons.ts';
import { openMenu } from '../wm/menus.ts';
import { openEmojiPicker } from './emoji-picker.ts';
import { copy, emojiImg, plainName, toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const DEFAULT_REACTION = '❤️';

/** Sends an action as the active account; says so when it could not be done. */
export async function act(env: ViewEnv, make: (as: string) => Action): Promise<boolean> {
  const as = env.engine.me();
  if (!as) return (toast(env.layer, t('error.signed-out')), false);
  const r = await env.engine.act(make(as));
  if (!r.ok) {
    const key = `error.${r.error?.code ?? 'internal'}`;
    toast(env.layer, `${t(key as Key)}${r.error?.message ? `: ${r.error.message}` : ''}`);
  }
  return r.ok;
}
/** A reaction is public the moment it is sent, so a wrong press can be taken back at once. */
async function react(
  env: ViewEnv,
  row: NoteRow,
  emoji: string,
  url: string | undefined,
  on: boolean,
  quiet = false,
): Promise<void> {
  const ok = await act(env, (as) => ({
    a: 'publish',
    as,
    what: on
      ? { k: 'reaction', id: row.id, emoji, url }
      : { k: 'delete', id: row.id, of: 'reaction', emoji },
  }));
  if (ok && on && !quiet)
    toast(
      env.layer,
      t('undo.reacted', { emoji: url ? `:${emoji.replace(/:/g, '')}:` : emoji }),
      () => void react(env, row, emoji, url, false),
    );
}

export function reactionChips(row: NoteRow, env: ViewEnv): HTMLElement | null {
  if (!row.reactions.length) return null;
  return h(
    'div',
    { class: 'chips' },
    row.reactions.map((r) =>
      h(
        'button',
        {
          class: r.mine ? 'rchip on' : 'rchip',
          title: r.emoji,
          'data-emoji': r.emoji,
          'aria-pressed': r.mine,
          onclick: (e) => (e.stopPropagation(), void react(env, row, r.emoji, r.url, !r.mine)),
        },
        r.url ? emojiImg(r.emoji, r.url) : r.emoji,
        h('span', null, countText(r.count, false, getLang())),
      ),
    ),
  );
}

export function actionRow(row: NoteRow, env: ViewEnv): HTMLElement {
  const lang = getLang();
  const n = (v: number): string => (v ? countText(v, row.counts.partial, lang) : '');
  const button = (
    name: IconName,
    label: Key,
    count: string,
    on: boolean,
    run: (el: HTMLElement) => void,
  ): HTMLElement => {
    const el: HTMLElement = h(
      'button',
      {
        class: on ? `act a-${name} on` : `act a-${name}`,
        title: t(label),
        'aria-label': t(label),
        'aria-pressed': on,
      },
      icon(name),
      h('span', null, count),
    );
    el.addEventListener('click', (e) => (e.stopPropagation(), run(el)));
    return el;
  };
  const mine = row.reactions.find((r) => r.mine);
  const quote = { quote: row.id, quoteOf: { name: plainName(row.author), text: excerpt(row) } };
  const publish = (what: Extract<Action, { a: 'publish' }>['what']) => () =>
    void act(env, (as) => ({ a: 'publish', as, what }));
  // A narrow tile folds the bookmark (unless it is set) and then the zap into the "…" menu: the row hides them by
  // the tile's width, and the menu offers whatever the row is not showing.
  const folded = (el: HTMLElement): boolean => getComputedStyle(el).display === 'none';
  const zapRun = (): void => toast(env.layer, t('act.zapSoon'));
  const markLabel: Key = row.mine.bookmarked ? 'act.unbookmark' : 'act.bookmark';
  const marked = (on: boolean): Promise<boolean> =>
    act(env, (as) => ({ a: 'bookmark', as, id: row.id, on }));
  const markRun = async (): Promise<void> => {
    const was = row.mine.bookmarked;
    if ((await marked(!was)) && was)
      toast(env.layer, t('undo.unbookmarked'), () => void marked(true));
  };
  const repost = async (): Promise<void> => {
    if (await act(env, (as) => ({ a: 'publish', as, what: { k: 'repost', id: row.id } })))
      toast(env.layer, t('undo.reposted'), publish({ k: 'delete', id: row.id, of: 'repost' }));
  };
  const zap = button(
    'zap',
    'act.zap',
    row.counts.zaps ? countText(row.counts.zaps, row.counts.partial, lang) : '',
    false,
    zapRun,
  );
  const mark = button('bookmark', markLabel, '', row.mine.bookmarked, () => void markRun());
  return h(
    'div',
    { class: 'acts' },
    button('reply', 'act.reply', n(row.counts.replies), false, () =>
      env.open('compose', {
        replyTo: row.id,
        replyOf: { name: plainName(row.author), text: excerpt(row) },
      }),
    ),
    button('repost', 'act.repost', n(row.counts.reposts), row.mine.reposted, (el) =>
      openMenu(env.layer, el, [
        row.mine.reposted
          ? { label: t('act.unrepost'), run: publish({ k: 'delete', id: row.id, of: 'repost' }) }
          : { label: t('act.repost'), run: () => void repost() },
        { label: t('act.quote'), run: () => env.open('compose', quote) },
      ]),
    ),
    button('smile', 'emoji.pick', '', false, (el) =>
      openEmojiPicker(env, el, (p) => void react(env, row, p.emoji, p.url, true)),
    ),
    button(
      'heart',
      'act.react',
      n(row.counts.reactions),
      Boolean(mine),
      () => void react(env, row, mine?.emoji ?? DEFAULT_REACTION, mine?.url, !mine),
    ),
    zap,
    mark,
    button('more', 'act.more', '', false, (el) =>
      openMenu(env.layer, el, [
        ...(folded(mark) ? [{ label: t(markLabel), run: () => void markRun() }] : []),
        ...(folded(zap) ? [{ label: t('act.zap'), run: zapRun }] : []),
        { label: t('menu.copyText'), run: () => void copy(env, fullText(row)) },
        {
          label: t('menu.copyLink'),
          run: () => void copy(env, `${location.origin}/n/${row.bech32}`),
        },
        { label: t('menu.copyId'), run: () => void copy(env, row.bech32) },
        {
          label: t('menu.mutePerson', { name: plainName(row.author) }),
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
          run: () =>
            void act(env, (as) => ({
              a: 'mute',
              as,
              target: { k: 'thread', id: row.id },
              on: true,
            })),
        },
        ...(row.mine.own
          ? [{ label: t('menu.delete'), danger: true, run: publish({ k: 'delete', id: row.id }) }]
          : []),
      ]),
    ),
  );
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
              ? `@${s.name}`
              : s.k === 'emoji'
                ? `:${s.code}:`
                : s.text,
    )
    .join('');
export const excerpt = (row: NoteRow): string => (fullText(row).split('\n')[0] ?? '').slice(0, 100);
