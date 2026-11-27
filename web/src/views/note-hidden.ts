// A note lkjstr does not show (docs/interface-hidden.md): one quiet line in its slot saying why, an inline Why with the
// reason's own setting where one exists, and Show when the engine may show it; a note shown although hidden carries a
// quiet line above it with Hide. Nothing of the hidden note is drawn: no face, no name, no body.
import type { NoteRow } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { readNoteState, writeNoteState } from '../shared/note-state.ts';
import { disposeLinkCards } from './link-cards.ts';
import { disposeNoteAudio } from './note-audio.ts';
import { threadClass } from './note-thread.ts';
import type { ViewEnv } from './registry.ts';

const REASONS = new Set([
  'muted-person',
  'muted-thread',
  'muted-word',
  'muted-hashtag',
  'their-muted-person',
  'their-muted-thread',
  'their-muted-word',
  'their-muted-hashtag',
  'repeated-content',
  'author-limit',
  'machine-payload',
  'language',
  'deleted',
  'expired',
]);
/** The settings entry each reason's Why opens; a reason without one has no switch. The link always reads
 * `hidden.setting`: the sentence before it already names the setting, and a setting's own title can be a single
 * kanji in Japanese or repeat that sentence (the visitor filter). */
const SETTING: Record<string, string> = {
  'muted-person': 'set.mute.person',
  'muted-thread': 'set.mute.thread',
  'muted-word': 'set.mute.word',
  'muted-hashtag': 'set.mute.hashtag',
  'repeated-content': 'visitorFilter',
  'author-limit': 'visitorFilter',
};
const known = (reason: string): string => (REASONS.has(reason) ? reason : 'other');
/** The one-line reason (also the wording of a shown note's line). */
export const hiddenText = (reason: string): string => t(`hidden.${known(reason)}` as Key);

/** The line that holds a hidden note's slot. */
export function hiddenRow(row: NoteRow, env: ViewEnv): HTMLElement {
  const hidden = row.hidden ?? { reason: 'other' };
  const reason = known(hidden.reason);
  const can = hidden.revealable === true && reason !== 'deleted' && reason !== 'expired';
  const detail = h('div', { class: 'hwhy', hidden: true });
  const why = h('button', { class: 'lnk', 'aria-expanded': 'false' }, t('hidden.why'));
  const el = h(
    'div',
    { class: `note hid${threadClass(row)}`, 'data-pass': '' }, // j and k pass over it, as over a divider
    h('div', { class: 'hline' }, h('span', null, hiddenText(reason)), why, can ? show() : null),
    detail,
  );
  why.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = detail.hidden;
    detail.hidden = !open;
    why.setAttribute('aria-expanded', String(open));
    if (open && !detail.firstChild) detail.append(...explain());
  });
  function explain(): (HTMLElement | string)[] {
    const at = SETTING[reason];
    // A muted word or hashtag is named when the engine says which of the reader's own entries matched.
    const named = hidden.detail && (reason === 'muted-word' || reason === 'muted-hashtag');
    const words = t(`hidden.why.${reason}${named ? '.named' : ''}` as Key, {
      detail: hidden.detail ?? '',
    });
    if (!at) return [words];
    const go = (e: Event): void => (e.stopPropagation(), void env.open('settings', { at }));
    return [words, ' ', h('button', { class: 'lnk', onclick: go }, t('hidden.setting'))];
  }
  function show(): HTMLElement {
    const ask = async (): Promise<void> => {
      if (await env.engine.reveal?.(el, row.key, true)) {
        writeNoteState(env.instance, row.id, { shown: true });
      } else {
        detail.hidden = false;
        why.setAttribute('aria-expanded', 'true');
        detail.replaceChildren(t('hidden.failed'));
      }
    };
    // A note the reader showed is shown again when its row comes back (scrolled to, or after a reload).
    if (readNoteState(env.instance, row.id).shown)
      requestAnimationFrame(() => void (el.isConnected && ask()));
    return h(
      'button',
      { class: 'lnk', onclick: (e: Event) => (e.stopPropagation(), void ask()) },
      t('hidden.show'),
    );
  }
  return el;
}

/** Above a note shown although hidden: why it was hidden, and Hide. */
export function shownLine(row: NoteRow, env: ViewEnv, el: () => HTMLElement): HTMLElement | null {
  if (!row.revealed) return null;
  const hide = (e: Event): void => {
    e.stopPropagation();
    writeNoteState(env.instance, row.id, { shown: false });
    void env.engine.reveal?.(el(), row.key, false);
  };
  return h(
    'div',
    { class: 'ctx hshown' },
    h('span', { class: 'clip' }, t('hidden.shown', { reason: hiddenText(row.revealed.reason) })),
    h('button', { class: 'lnk', onclick: hide }, t('hidden.hide')),
  );
}

/** A content warning (H5): the body folds behind it, and nothing behind it is drawn or fetched before Show. Shown, the
 * warning stays as a quiet line above the body with Hide (unless Settings opens them all). */
export function warned(
  row: NoteRow,
  env: ViewEnv,
  covered: boolean,
  content: () => HTMLElement,
  changed: (open: boolean) => void,
): HTMLElement[] {
  const said = t('note.cw', { reason: row.cw ?? '' });
  const cover = (): HTMLElement => {
    const b = h('button', { class: 'cw' }, said, h('span', { class: 'lnk' }, t('note.show')));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      writeNoteState(env.instance, row.id, { warning: true });
      b.replaceWith(...open());
      changed(true);
    });
    return b;
  };
  const open = (): HTMLElement[] => {
    const box = content();
    const hide = (e: Event): void => {
      e.stopPropagation();
      writeNoteState(env.instance, row.id, { warning: false });
      disposeLinkCards(box);
      disposeNoteAudio(box);
      line.remove();
      box.replaceWith(cover());
      changed(false);
    };
    const line = h(
      'div',
      { class: 'ctx cwline' },
      h('span', { class: 'clip' }, said),
      env.settings.get().showSensitive
        ? null
        : h('button', { class: 'lnk', onclick: hide }, t('hidden.hide')),
    );
    return [line, box];
  };
  return covered ? [cover()] : open();
}
