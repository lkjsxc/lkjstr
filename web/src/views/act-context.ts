import type { ActRef, NoteRow } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { reactionLabel } from '../shared/reactions.ts';
import { emojiImg, nameButton } from './parts.ts';
import type { ViewEnv } from './registry.ts';

/** A display-only act: the existing reaction chip without a count, or the repost mark. */
export function actChip(act: ActRef): HTMLElement {
  if (act.type === 'repost')
    return h('span', { class: 'act-chip act-repost', title: t('act.repost') }, icon('repost'));
  const emoji = act.emoji?.emoji ?? '+';
  const url = emoji.startsWith(':') ? act.emoji?.url : undefined;
  return h(
    'span',
    { class: 'rchip act-chip', title: reactionLabel(emoji) },
    url ? emojiImg(emoji, url) : reactionLabel(emoji),
  );
}

function context(row: NoteRow, env: ViewEnv): HTMLElement | null {
  if (!row.act || !row.actOn) return null;
  const target = row.actOn;
  const [before = '', after = ''] = t(`act.on.${target.type}`).split('{name}');
  return h(
    'div',
    { class: 'ctx act-context' },
    actChip(row.act),
    h(
      'span',
      { class: 'act-phrase' },
      h('span', null, before),
      nameButton(target.actor, env, 'name quiet'),
      h('span', null, after),
    ),
    actChip(target),
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
