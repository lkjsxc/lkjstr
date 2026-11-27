// What a draft answers or quotes: the line over a reply, with a way to drop it, and the quoted note's card under the
// field, as the published note will carry it.
import type { Author } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { avatar, displayName } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export type Ref = { name: string; text: string };
/** The quoted note as kept with the draft: who and when, its opening text, how many pictures, its warning. */
export type Quoted = {
  readonly author: Author;
  readonly at: number;
  readonly text: string;
  readonly media: number;
  readonly cw?: string;
};

const dropButton = (clear: () => void): HTMLElement =>
  h(
    'button',
    { class: 'x', title: t('compose.drop'), 'aria-label': t('compose.drop'), onclick: clear },
    '×',
  );

export const contextLine = (
  label: Key,
  ref: Ref | undefined,
  clear: () => void,
): HTMLElement | null =>
  ref
    ? h(
        'div',
        { class: 'cctx' },
        h('span', { class: 'muted clip' }, t(label, { name: ref.name }), ' ', ref.text),
        dropButton(clear),
      )
    : null;

/** The quoted note in the quoted-note surface, as in a note: face, name, time, its first lines or its warning, and
 * how many pictures it has. × takes the quote off the draft. A draft given back by the engine keeps only the quote's
 * id: its card then just says that a note is quoted. */
export function quotedCard(q: Quoted | undefined, env: ViewEnv, clear: () => void): HTMLElement {
  const label = t('compose.quoted');
  if (!q)
    return h(
      'div',
      { class: 'quote cquote' },
      h('div', { class: 'qhead' }, h('span', { class: 'muted clip' }, label), dropButton(clear)),
    );
  const when = noteTime(q.at, Date.now(), {
    relative: env.settings.get().relativeTime,
    lang: getLang(),
  });
  return h(
    'div',
    { class: 'quote cquote', 'aria-label': label },
    h(
      'div',
      { class: 'qhead' },
      avatar(q.author, 'av sm'),
      h('span', { class: 'name clip' }, displayName(q.author)),
      h('time', { title: fullTime(q.at) }, when),
      dropButton(clear),
    ),
    q.cw !== undefined
      ? h('div', { class: 'muted' }, t('note.cw', { reason: q.cw }))
      : q.text
        ? h('div', { class: 'qtext' }, h('div', null, q.text))
        : null,
    q.cw === undefined && q.media
      ? h('div', { class: 'muted qmedia' }, icon('image'), String(q.media))
      : null,
  );
}
