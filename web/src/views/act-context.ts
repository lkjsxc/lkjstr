import type { ActRef, NoteRow } from '../engine/protocol.ts';
import { isEmojiGrapheme } from '../shared/emoji-text.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { reactionLabel } from '../shared/reactions.ts';
import { emojiImg, nameButton } from './parts.ts';
import type { ViewEnv } from './registry.ts';

/** A display-only act: the existing reaction chip without a count, or the repost mark. A Unicode emoji chip is
 * itself the emoji's mark (emoji-peek.ts). `alone`: it is not inside a button, so its emoji is a tab stop of its
 * own; inside one (a notification's excerpt) the button takes the keyboard for it. */
export function actChip(act: ActRef, alone = false): HTMLElement {
  if (act.type === 'repost')
    return h('span', { class: 'act-chip act-repost', title: t('act.repost') }, icon('repost'));
  const emoji = act.emoji?.emoji ?? '+';
  const url = emoji.startsWith(':') ? act.emoji?.url : undefined;
  const label = reactionLabel(emoji);
  const mark = !url && isEmojiGrapheme(label);
  return h(
    'span',
    {
      class: mark ? 'rchip act-chip uemo' : 'rchip act-chip',
      title: url || mark ? null : label,
      tabindex: mark && alone ? 0 : null,
    },
    url ? emojiImg(emoji, url, alone, act.emoji) : label,
  );
}

function context(row: NoteRow, env: ViewEnv): HTMLElement | null {
  if (!row.act || !row.actOn) return null;
  const target = row.actOn;
  const [before = '', after = ''] = t(`act.on.${target.type}`).split('{name}');
  return h(
    'div',
    { class: 'ctx act-context' },
    actChip(row.act, true),
    h(
      'span',
      { class: 'act-phrase' },
      h('span', null, before),
      nameButton(target.actor, env, 'name quiet'),
      h('span', null, after),
    ),
    actChip(target, true),
  );
}

const drawn = new WeakMap<HTMLElement, string>();
/** Late metadata changes only the context line; the terminal note body stays in place. */
export function patchActContext(el: HTMLElement, row: NoteRow, env: ViewEnv): void {
  const signature = JSON.stringify([row.act, row.actOn]);
  if (drawn.get(el) === signature) return;
  drawn.set(el, signature);
  const old = el.querySelector<HTMLElement>(':scope > .act-context');
  const focused = old?.querySelector('.name') === document.activeElement;
  const next = context(row, env);
  if (old && next) old.replaceWith(next);
  else if (old) old.remove();
  else if (next) el.prepend(next);
  if (focused) next?.querySelector<HTMLElement>('.name')?.focus({ preventScroll: true });
}
