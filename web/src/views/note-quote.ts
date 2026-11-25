import type { Quote } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { readNoteState, writeNoteState } from '../shared/note-state.ts';
import { linkCards } from './link-cards.ts';
import { mediaGrid } from './note-media.ts';
import { faceButton, how, nameButton, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const timeOf = (at: number, env: ViewEnv): string =>
  noteTime(at, Date.now(), { relative: env.settings.get().relativeTime, lang: getLang() });
export function quoteCard(q: Quote, env: ViewEnv, noteId: string): HTMLElement {
  if (q.state !== 'ok')
    return h(
      'div',
      { class: q.state === 'loading' ? 'quote muted qloading' : 'quote muted' },
      t(`quote.${q.state}`),
    );
  const settings = env.settings.get();
  const title = plainName(q.author);
  const open = readNoteState(env.instance, noteId).quotes?.includes(q.id);
  const body = (): HTMLElement => {
    const next = q.nextId;
    return h(
      'div',
      { 'data-previews': settings.linkPreviews && q.previews?.length ? q.id : null },
      q.segments.length ? h('div', { class: 'qtext' }, segments(q.segments, env, true)) : null,
      mediaGrid(q.media, env, title, q.id),
      settings.linkPreviews ? linkCards(q.previews) : null,
      next === noteId || next === q.id
        ? h('div', { class: 'muted clip' }, t('embed.cycle'))
        : next
          ? h(
              'button',
              {
                class: 'lnk clip',
                onclick: (e) => {
                  e.stopPropagation();
                  env.open('thread', { id: next }, how(e as MouseEvent));
                },
              },
              t('embed.deep'),
            )
          : null,
    );
  };
  const cover = (): HTMLElement => {
    const button = h(
      'button',
      { class: 'cw' },
      t('note.cw', { reason: q.cw ?? '' }),
      h('span', { class: 'lnk' }, t('note.show')),
    );
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      writeNoteState(env.instance, noteId, {
        quotes: [...(readNoteState(env.instance, noteId).quotes ?? []), q.id].slice(-16),
      });
      const content = body();
      button.replaceWith(content);
      content.dispatchEvent(new Event('note-content-changed', { bubbles: true }));
    });
    return button;
  };
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
    q.cw !== undefined && !settings.showSensitive && !open ? cover() : body(),
  );
  const go = (e: MouseEvent | KeyboardEvent): void => {
    e.stopPropagation();
    env.open(
      'thread',
      { id: q.id, title },
      e instanceof MouseEvent ? how(e) : { split: e.shiftKey },
    );
  };
  el.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('button, a, audio, video') && !String(getSelection())) go(e);
  });
  el.addEventListener('keydown', (e) => void (e.target === el && e.key === 'Enter' && go(e)));
  return el;
}
