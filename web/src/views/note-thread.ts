// What a note in a thread draws differently (docs/interface-thread.md): its place in the rail and the branches, whom
// it answers when that is not plain from where it stands, and, above the focus, a compact body of two lines.
import type { NoteRow } from '../engine/protocol.ts';
import { clockOf, dayOf } from '../shared/format.ts';
import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { nameButton, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import type { ThreadLook } from './thread-plan.ts';

export const lookOf = (row: NoteRow): ThreadLook | undefined =>
  (row as NoteRow & { look?: ThreadLook }).look;

/** The classes that place a thread note: its role, the rail and the branch lines. */
export function threadClass(row: NoteRow): string {
  const role = row.thread?.role;
  if (!role) return '';
  const l = lookOf(row) ?? {};
  const flags = (['compact', 'above', 'below', 'step', 'last'] as const).filter((f) => l[f]);
  return ` th-${role}${flags.map((f) => ` th-${f}`).join('')}`;
}

/** In a thread every time has its date: a conversation runs over days. In a narrow tile the clock gives way first. */
export const threadTime = (at: number): Child[] => [
  h('span', { class: 'tday' }, dayOf(at)),
  h('span', { class: 'tclock' }, ` ${clockOf(at)}`),
];

/** Above the header, as Home says what a note answers: whom, when that is not the note its line comes from. */
export function threadMark(row: NoteRow, env: ViewEnv): HTMLElement | null {
  const to = lookOf(row)?.to;
  if (!to) return null;
  return h(
    'div',
    { class: 'ctx', title: t('thread.answers', { name: plainName(to) }) },
    icon('reply'),
    h('span', null, nameButton(to, env, 'name quiet')),
  );
}

/** A note above the focus, folded: two lines of its text and a quiet mark for what else it holds. */
export function compactBody(row: NoteRow, env: ViewEnv): HTMLElement {
  const pictures = row.media.length;
  const extra = pictures || row.quotes.length;
  return h(
    'div',
    { class: 'content' },
    h(
      'div',
      { class: 'text' },
      row.cw !== undefined ? t('note.cw', { reason: row.cw }) : segments(row.segments, env, true),
      extra
        ? h(
            'span',
            { class: 'tholds' },
            icon(pictures ? 'image' : 'link'),
            pictures > 1 ? pictures : null,
          )
        : null,
    ),
  );
}
