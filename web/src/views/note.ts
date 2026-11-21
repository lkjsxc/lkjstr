// A note, drawn from the engine's view model exactly as it arrives. A press on a person opens their profile, on the
// text the thread, on the time the author's Home then, on a quoted card the quoted note: the same everywhere.
import type { NoteRow } from '../engine/protocol.ts';
import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { readNoteState, writeNoteState } from '../shared/note-state.ts';
import { patchActContext } from './act-context.ts';
import { linkCards } from './link-cards.ts';
import { actionRow, reactionChips } from './note-actions.ts';
import { stableNoteWidths } from './note-fit-geometry.ts';
import { mediaGrid } from './note-media.ts';
import { quoteCard } from './note-quote.ts';
import { compactBody, lookOf, threadClass, threadMark } from './note-thread.ts';
import { deliveryMark, timeOf } from './note-time.ts';
import { displayName, faceButton, how, nameButton, nipMark, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { momentTime } from './their-home.ts';

/** Long text folds by whole lines; the button appears only when something is actually cut off. */
function fold(text: HTMLElement): void {
  const more = h('button', { class: 'lnk fold' }, t('note.more'));
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    text.classList.add('open');
    const note = text.closest<HTMLElement>('[data-note]');
    if (note?.dataset.instance && note.dataset.note)
      writeNoteState(note.dataset.instance, note.dataset.note, { unfolded: true });
    text.closest('.content')?.classList.remove('folded');
    more.remove();
  });
  text.closest('.content')?.classList.add('folded');
  text.after(more);
}

const drawnBy = new WeakMap<HTMLElement, string>(); // the author each drawn note shows
/** The line over the text: name, NIP-05, time. One line of fixed height, whatever is known of the author. */
function head(row: NoteRow, env: ViewEnv, dated: boolean): HTMLElement {
  const a = row.author;
  return h(
    'div',
    { class: 'nhead' },
    nameButton(a, env),
    nipMark(a),
    a.bot ? h('span', { class: 'badge' }, t('note.bot')) : null,
    momentTime(row, env, timeOf(row, env, dated)),
    // Where the tile is too narrow for a bookmark button, a set bookmark is this mark instead.
    h(
      'span',
      { class: 'bmark', title: t('note.bookmarked'), hidden: !row.mine.bookmarked },
      icon('bookmark'),
    ),
  );
}

export function renderNote(row: NoteRow, env: ViewEnv, dated = false): HTMLElement {
  const state = readNoteState(env.instance, row.id);
  if (row.hidden && !state.shown) {
    const el = h(
      'div',
      { class: 'note hid muted' },
      t(`hidden.${row.hidden.reason === 'language' ? 'language' : 'other'}`),
      ' ',
    );
    el.append(
      h(
        'button',
        {
          class: 'lnk',
          onclick: () => {
            writeNoteState(env.instance, row.id, { shown: true });
            const n = fresh({ ...row, hidden: undefined });
            n.dataset.key = row.key;
            el.className = 'note-shell revealed';
            el.replaceChildren(n);
            n.dispatchEvent(new CustomEvent('note-revealed', { bubbles: true }));
          },
        },
        t('hidden.show'),
      ),
    );
    const fresh = (r: NoteRow): HTMLElement => {
      const n = renderNote(r, env, dated);
      requestAnimationFrame(() => fitNote(n));
      return n;
    };
    return el;
  }
  const openThread = (e: MouseEvent): void => {
    if (String(getSelection())) return; // selecting text is not a press
    env.open('thread', { id: row.id, title: plainName(row.author) }, how(e));
  };
  const context: Child[] = [];
  // In a thread what a note answers is in view, and a repost says nothing about the conversation.
  if (row.repostedBy && !(row.act && row.actOn) && !row.thread) {
    const { actors, others } = row.repostedBy;
    const names = actors.flatMap((a, i) => [
      i ? t('list.sep') : '',
      nameButton(a, env, 'name quiet'),
    ]);
    context.push(
      h(
        'div',
        { class: 'ctx' },
        icon('repost'),
        h('span', null, names, others ? t('ctx.others', { n: others }) : '', t('ctx.reposted')),
      ),
    );
  }
  const answers = threadMark(row, env);
  if (answers) context.push(answers);
  if (row.replyTo && !row.thread)
    context.push(
      h(
        'div',
        { class: 'ctx' },
        icon('reply'),
        h(
          'span',
          { class: 'clip' },
          nameButton(row.replyTo.author, env, 'name quiet'),
          ' ',
          row.replyTo.excerpt,
        ),
      ),
    );

  if (row.channel && (!row.thread || row.thread.role === 'focus')) {
    // A channel message read outside its channel says where it was said, and leads there.
    const { id, name } = row.channel;
    const go = (e: Event): void => {
      e.stopPropagation();
      env.open('channel', { id, title: name || undefined }, how(e as MouseEvent));
    };
    context.push(
      h(
        'div',
        { class: 'ctx chan' },
        h('button', { class: 'clip', onclick: go }, `# ${name || t('view.channel')}`),
      ),
    );
  }

  const look = lookOf(row);
  const covered =
    row.cw !== undefined && !env.settings.get().showSensitive && !state.warning && !look?.compact;
  let text = h('div');
  const makeContent = (): HTMLElement => {
    text = h('div', { class: state.unfolded ? 'text open' : 'text' }, segments(row.segments, env));
    return h(
      'div',
      { class: 'content' },
      row.segments.length ? text : null,
      mediaGrid(row.media, env, plainName(row.author), row.id),
      row.quotes.map((q) => quoteCard(q, env, row.id)),
      env.settings.get().linkPreviews ? linkCards(row.previews) : null,
    );
  };
  let body: HTMLElement;
  if (covered) {
    body = h(
      'button',
      { class: 'cw' },
      t('note.cw', { reason: row.cw ?? '' }),
      h('span', { class: 'lnk' }, t('note.show')),
    );
    body.addEventListener('click', (e) => {
      e.stopPropagation();
      writeNoteState(env.instance, row.id, { warning: true });
      body.replaceWith(makeContent());
      text.dispatchEvent(new CustomEvent('note-revealed', { bubbles: true }));
      fold(text);
    });
  } else body = look?.compact ? compactBody(row, env) : makeContent();
  const el = h(
    'article',
    {
      class: `note${threadClass(row)}${row.pending ? ' pending' : ''}`,
      'data-note': row.id,
      'data-send': deliveryMark(row) ?? null,
      'data-previews': row.previews ? '' : null,
      'data-instance': env.instance,
    },
    context,
    h(
      'div',
      { class: 'nrow' },
      faceButton(row.author, env),
      h(
        'div',
        { class: 'nmain' },
        head(row, env, dated),
        body,
        look?.compact ? actionRow(row, env, false) : [actionRow(row, env), reactionChips(row, env)],
      ),
    ),
  );
  patchActContext(el, row, env);
  drawnBy.set(el, JSON.stringify(row.author));
  const plain = (e: Event): boolean =>
    !(e.target as Element).closest('button, a, input, textarea, video, audio, .quote');
  // A compact note above a thread's focus opens in place first (thread.ts keeps that with the tab).
  const expand = (): unknown =>
    el.dispatchEvent(new CustomEvent('thread-open', { bubbles: true, detail: row.id }));
  el.addEventListener(
    'click',
    (e) => void (plain(e) && (look?.compact ? expand() : openThread(e))),
  );
  // A middle click opens the thread behind (and never starts the browser's autoscroll).
  el.addEventListener('mousedown', (e) => void (e.button === 1 && plain(e) && e.preventDefault()));
  el.addEventListener('auxclick', (e) => void (e.button === 1 && plain(e) && openThread(e)));
  return el;
}

/** The body of a note without what changes all the time (counts, reactions, the reader's own marks) and without
 * its author, whose name and picture arrive after the note does. */
export const bodySig = (row: NoteRow): string =>
  JSON.stringify({
    ...row,
    author: 0,
    pending: 0,
    connecting: 0,
    unconfirmed: 0,
    counts: 0,
    reactions: 0,
    mine: 0,
    act: !!row.act,
    actOn: !!row.actOn,
    repostedBy: row.act && row.actOn ? 0 : row.repostedBy,
  });
/** Redraws only the author's line and face, the chips and the action row of a drawn note: the text stays as the
 * reader left it (unfolded, uncovered), pictures are not loaded again and nothing moves under the pointer. */
export function patchNote(el: HTMLElement, row: NoteRow, env: ViewEnv, dated = false): void {
  const main = el.querySelector(':scope > .nrow > .nmain');
  if (!main) return;
  patchActContext(el, row, env);
  el.classList.toggle('pending', row.pending === true);
  const delivery = deliveryMark(row);
  if (delivery) el.dataset.send = delivery;
  else delete el.dataset.send;
  const was = main.querySelector<HTMLElement>(':scope > .nhead');
  const name = was?.querySelector('.name');
  const keep = name !== null && name === document.activeElement;
  was?.replaceWith(head(row, env, dated));
  if (keep)
    main.querySelector<HTMLElement>(':scope > .nhead > .name')?.focus({ preventScroll: true });
  if (JSON.stringify(row.author) !== drawnBy.get(el)) {
    drawnBy.set(el, JSON.stringify(row.author));
    el.querySelector(':scope > .nrow > .avb')?.replaceWith(faceButton(row.author, env));
  }
  // The button that was pressed is drawn again: the keyboard stays on its successor.
  const held = document.activeElement?.closest('.acts, .chips')?.parentElement === main;
  const mark = held ? heldMark(document.activeElement) : '';
  main.querySelector(':scope > .chips')?.remove();
  const compact = el.classList.contains('th-compact');
  const acts = actionRow(row, env, !compact);
  main.querySelector(':scope > .acts')?.replaceWith(acts);
  const chips = compact ? null : reactionChips(row, env);
  if (chips) acts.after(chips);
  if (mark) main.querySelector<HTMLElement>(mark)?.focus({ preventScroll: true });
}

const heldMark = (el: Element | null): string => {
  const act = [...(el?.classList ?? [])].find((c) => c.startsWith('a-'));
  const emoji = el?.getAttribute('data-emoji');
  return act ? `.acts > .${act}` : emoji ? `.chips > [data-emoji="${CSS.escape(emoji)}"]` : '';
};

const overflowingText = (el: HTMLElement): HTMLElement | undefined => {
  const text = el.querySelector<HTMLElement>('.content > .text');
  return text &&
    !el.classList.contains('th-compact') &&
    !el.querySelector('.fold') &&
    !text.classList.contains('open') &&
    text.scrollHeight > text.clientHeight + 2
    ? text
    : undefined;
};

/** After a note is in the document: fold what is too long. */
export function fitNote(el: HTMLElement): void {
  const text = overflowingText(el);
  if (text) fold(text);
}

/** Measure the batch before fold controls invalidate another note's layout. */
export function fitNotes(elements: readonly HTMLElement[]): void {
  if (!stableNoteWidths(elements)) {
    for (const el of elements) fitNote(el);
    return;
  }
  const overflowing = elements.map(overflowingText);
  for (const text of overflowing) if (text) fold(text);
}
export { displayName };
