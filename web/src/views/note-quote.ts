import type { Quote } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { readNoteState, writeNoteState } from '../shared/note-state.ts';
import { faceButton, how, nameButton, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const timeOf = (at: number, env: ViewEnv): string =>
  noteTime(at, Date.now(), { relative: env.settings.get().relativeTime, lang: getLang() });
export function quoteCard(q: Quote, env: ViewEnv, noteId: string): HTMLElement {
  if (q.state !== 'ok') return h('div', { class: 'quote muted' }, t(`quote.${q.state}`));
  const open = readNoteState(env.instance, noteId).quotes?.includes(q.id);
  const body = (): HTMLElement => h('div', { class: 'qtext' }, segments(q.segments, env, true));
  const cover = h(
    'button',
    { class: 'cw' },
    t('note.cw', { reason: q.cw ?? '' }),
    ' ',
    t('note.show'),
  );
  cover.addEventListener('click', (e) => {
    e.stopPropagation();
    writeNoteState(env.instance, noteId, {
      quotes: [...(readNoteState(env.instance, noteId).quotes ?? []), q.id].slice(-16),
    });
    cover.replaceWith(body());
  });
  const el = h(
    'div',
    { class: 'quote', role: 'link', tabindex: 0 },
    h(
      'div',
      { class: 'qhead' },
      faceButton(q.author, env, 'av sm'),
      nameButton(q.author, env),
      h('time', { title: fullTime(q.at) }, timeOf(q.at, env)),
    ),
    q.cw !== undefined && !open ? cover : body(),
    q.cw === undefined && q.media.length
      ? h('div', { class: 'muted qmedia' }, icon('image'), String(q.media.length))
      : null,
  );
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    env.open('thread', { id: q.id, title: plainName(q.author) }, how(e));
  });
  return el;
}
