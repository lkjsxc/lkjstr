// Notifications preserve their act group while opening the terminal note when it exists.
import type { NotificationRow } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { reactionLabel } from '../shared/reactions.ts';
import { actChip } from './act-context.ts';
import { renderNote } from './note.ts';
import { emojiImg, faceButton, how, nameButton, plainName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const aboutAct = (row: NotificationRow) => row.target?.act ?? row.pendingAct?.act;
function headline(row: NotificationRow): Key {
  const act = aboutAct(row);
  return act && (row.type === 'reaction' || row.type === 'repost')
    ? `notif.${row.type}.${act.type === 'reaction' ? 'onReaction' : 'onRepost'}`
    : `notif.${row.type}`;
}
function targetLine(row: NotificationRow, env: ViewEnv): HTMLElement | null {
  const target = row.target;
  if (target) {
    // Older engines can return an intermediate reaction as the target. Do not quote its token.
    const excerpt =
      !target.act && /^(?:[+-]|:[a-z0-9_]+:)$/i.test(target.excerpt.trim()) ? '' : target.excerpt;
    if (!target.act && !excerpt) return null;
    return h(
      'button',
      {
        class: target.act ? 'excerpt muted act-target' : 'excerpt muted clip',
        onclick: (e) => env.open('thread', { id: target.id }, how(e as MouseEvent)),
      },
      target.act ? actChip(target.act) : null,
      target.act ? h('span', { class: 'clip' }, excerpt) : excerpt,
    );
  }
  const pending = row.pendingAct;
  if (!pending) return null;
  const key =
    pending.state === 'loading'
      ? 'act.note.pending'
      : pending.state === 'failed'
        ? 'quote.error'
        : 'quote.missing';
  return h(
    'div',
    { class: 'excerpt muted act-target' },
    actChip(pending.act),
    h('span', { class: 'clip' }, t(key)),
  );
}

/** "A and B reacted to your note": each person opens their profile; a press anywhere else opens what the news
 * is about, as on a note. */
export function renderNotification(row: NotificationRow, env: ViewEnv): HTMLElement {
  if (row.note && (row.type === 'mention' || row.type === 'reply')) {
    const el = renderNote(row.note, env);
    if (row.unread) el.classList.add('unread');
    return el;
  }
  const names = row.actors
    .slice(0, 2)
    .flatMap((a, i) => [i ? t('list.sep') : '', nameButton(a, env)]);
  const rest = row.others + Math.max(0, row.actors.length - 2);
  const mark =
    row.type === 'reaction' && row.emoji
      ? row.emoji.url && row.emoji.emoji.startsWith(':')
        ? emojiImg(row.emoji.emoji, row.emoji.url)
        : reactionLabel(row.emoji.emoji)
      : icon(row.type === 'repost' ? 'repost' : row.type === 'zap' ? 'zap' : 'user');
  const target = row.target;
  const first = row.actors[0];
  const go = (e: MouseEvent): void => {
    if (String(getSelection())) return; // selecting text is not a press
    if (target) env.open('thread', { id: target.id }, how(e));
    else if (first) env.open('profile', { pubkey: first.pubkey, title: plainName(first) }, how(e));
  };
  const plain = (e: Event): boolean => !(e.target as Element).closest('button, a');
  const el = h(
    'div',
    { class: row.unread ? 'notif unread' : 'notif' },
    h('span', { class: `nmark k-${row.type}` }, mark),
    h(
      'div',
      { class: 'nmain' },
      h(
        'div',
        { class: 'nfaces' },
        row.actors.slice(0, 6).map((a) => faceButton(a, env, 'av sm')),
        h(
          'time',
          { title: fullTime(row.at) },
          noteTime(row.at, Date.now(), {
            relative: env.settings.get().relativeTime,
            lang: getLang(),
          }),
        ),
      ),
      h(
        'div',
        null,
        names,
        rest ? t('ctx.others', { n: rest }) : '',
        t(headline(row), { sats: row.sats ?? 0 }),
      ),
      row.comment ? h('div', { class: 'text' }, row.comment) : null,
      targetLine(row, env),
    ),
  );
  el.addEventListener('click', (e) => void (plain(e) && go(e)));
  el.addEventListener('mousedown', (e) => void (e.button === 1 && plain(e) && e.preventDefault()));
  el.addEventListener('auxclick', (e) => void (e.button === 1 && plain(e) && go(e)));
  return el;
}
