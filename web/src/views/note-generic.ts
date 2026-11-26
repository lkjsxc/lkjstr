// N2 public generic face. The engine supplies classified content and typed references.
import type { GenericRef, GenericTagLine, NoteRow } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { readNoteState, writeNoteState } from '../shared/note-state.ts';
import { createNoteBody } from './note-fold.ts';
import { how, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

function openReference(ref: GenericRef, env: ViewEnv, event: MouseEvent): void {
  if (ref.type === 'person') env.open('profile', { pubkey: ref.pubkey });
  else if (ref.type === 'topic') env.open('hashtag', { tag: ref.tag });
  else if (ref.type === 'event') env.open('thread', { id: ref.id });
  else if (ref.type === 'address')
    env.open('thread', { ref: `${ref.kind}:${ref.author}:${ref.d}` });
  else if (ref.type === 'link') window.open(ref.url, '_blank', 'noopener,noreferrer');
  else if (ref.type === 'relay') env.open('relay', { relay: ref.url }, how(event));
  event.stopPropagation();
}
function tagLine(line: GenericTagLine, env: ViewEnv): HTMLElement {
  const ref = line.ref;
  const action = ref
    ? h(
        'button',
        {
          class: 'lnk generic-value',
          onclick: (event: Event) => openReference(ref, env, event as MouseEvent),
        },
        line.text,
      )
    : h(
        'button',
        {
          class: 'generic-value generic-raw',
          title: line.text,
          onclick: (event: Event) => {
            event.stopPropagation();
            (event.currentTarget as HTMLElement).classList.toggle('expanded');
          },
        },
        line.text,
      );
  return h(
    'div',
    { class: 'generic-tag' },
    h(
      'span',
      { class: 'generic-name' },
      line.meaning ? t(`tag.${line.meaning}` as Key) : line.name,
    ),
    action,
  );
}
export function genericBody(row: NoteRow, env: ViewEnv, allowFold: boolean): HTMLElement {
  const face = row.face;
  if (!face) return h('div', { class: 'content' });
  const data = face.form === 'data';
  const hasContent = row.segments.length > 0;
  const state = readNoteState(env.instance, row.id);
  const content =
    face.form === 'empty'
      ? null
      : h(
          'div',
          { class: `${state.unfolded ? 'text open' : 'text'}${data ? ' generic-data' : ''}` },
          segments(row.segments, env),
        );
  const details = h(
    'div',
    { class: 'generic-tags', hidden: !(state.genericDetails ?? !(face.alt || hasContent)) },
    face.tags.map((line) => tagLine(line, env)),
    face.moreTags ? h('span', { class: 'quiet' }, t('tag.more', { n: face.moreTags })) : null,
  );
  const disclosure = h(
    'button',
    {
      class: 'lnk generic-disclosure',
      'aria-expanded': String(!details.hidden),
      onclick: (event: Event) => {
        event.stopPropagation();
        details.hidden = !details.hidden;
        writeNoteState(env.instance, row.id, { genericDetails: !details.hidden });
        disclosure.setAttribute('aria-expanded', String(!details.hidden));
      },
    },
    t('generic.details'),
    h('span', { class: 'quiet' }, ` ${face.tags.length + face.moreTags}`),
  );
  return h(
    'div',
    { class: 'content generic-face' },
    face.alt ? h('div', { class: 'generic-alt' }, face.alt) : null,
    content
      ? createNoteBody(allowFold, state.unfolded === true, [content], data)
      : !face.alt
        ? h('div', { class: 'quiet' }, t('generic.empty'))
        : null,
    disclosure,
    details,
  );
}
