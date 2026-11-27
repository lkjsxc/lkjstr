// A note, drawn from the engine's view model exactly as it arrives. A press on a person opens their profile, on the
// text the thread, on the time the author's Home then, on a quoted card the quoted note: the same everywhere.
import type { NoteRow } from '../engine/protocol.ts';
import { type Child, h } from '../shared/h.ts';
import { hasKey, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { readNoteState } from '../shared/note-state.ts';
import { patchActContext } from './act-context.ts';
import { linkCards } from './link-cards.ts';
import { actionRow, reactionChips } from './note-actions.ts';
import { createNoteBody, fitNote } from './note-fold.ts';
import { genericBody } from './note-generic.ts';
import { hiddenRow, shownLine, warned } from './note-hidden.ts';
import type { NoteImageQueue } from './note-image-queue.ts';
import { mediaGrid } from './note-media.ts';
import { quoteCard } from './note-quote.ts';
import { compactBody, lookOf, threadClass, threadMark } from './note-thread.ts';
import { deliveryMark, timeOf } from './note-time.ts';
import { stamp } from './note-via.ts';
import { how, nameButton, nipMark, noteFace, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

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
    stamp(row, env, timeOf(row, env, dated)),
    // Where the tile is too narrow for a bookmark button, a set bookmark is this mark instead.
    h(
      'span',
      { class: 'bmark', title: t('note.bookmarked'), hidden: !row.mine.bookmarked },
      icon('bookmark'),
    ),
  );
}

export function renderNote(
  row: NoteRow,
  env: ViewEnv,
  dated = false,
  options?: { previous?: HTMLElement; lazyFace?: boolean; queueImage?: NoteImageQueue },
): HTMLElement {
  const state = readNoteState(env.instance, row.id);
  if (row.hidden) return hiddenRow(row, env);
  const openThread = (e: MouseEvent): void => {
    if (String(getSelection())) return; // selecting text is not a press
    env.open('thread', { id: row.id, title: plainName(row.author) }, how(e));
  };
  const kindKey = `kind.${row.eventKind}`;
  const context: Child[] =
    row.eventKind === undefined
      ? []
      : [
          h(
            'div',
            { class: 'ctx' },
            t(hasKey(kindKey) ? kindKey : 'kind.other', { n: row.eventKind }),
          ),
        ];
  // In a thread what a note answers is in view, and a repost says nothing about the conversation.
  if (row.repostedBy && !(row.act && row.actOn) && !row.thread) {
    const { actors, others } = row.repostedBy;
    const names = actors.flatMap((a, i) => [
      i ? t('list.sep') : '',
      nameButton(a, env, 'name quiet'),
    ]);
    const more = others ? t(others === 1 ? 'ctx.other' : 'ctx.others', { n: others }) : '';
    const said = `${actors.map(plainName).join(t('list.sep'))}${more}${t('ctx.reposted')}`;
    context.push(
      h(
        'div',
        { class: 'ctx' },
        icon('repost'),
        // The names give way, each cut on its own; what they did stays whole.
        h('span', { class: 'rwho', title: said }, names),
        h('span', { class: 'rdid' }, `${more}${t('ctx.reposted')}`),
      ),
    );
  }
  const answers = threadMark(row, env);
  if (answers) context.push(answers);
  const shown = shownLine(row, env, () => el);
  if (shown) context.push(shown);
  if (row.replyTo && !row.thread)
    context.push(
      h(
        'div',
        { class: 'ctx' },
        icon('reply'),
        h(
          'span',
          { class: 'clip', title: `${plainName(row.replyTo.author)} ${row.replyTo.excerpt}` },
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
        h(
          'button',
          { class: 'clip', title: `# ${name || t('view.channel')}`, onclick: go },
          `# ${name || t('view.channel')}`,
        ),
      ),
    );
  }

  const look = lookOf(row);
  const allowFold = !row.thread || row.thread.role === 'reply';
  const covered =
    row.cw !== undefined && !env.settings.get().showSensitive && !state.warning && !look?.compact;
  const makeContent = (): HTMLElement => {
    const { unfolded } = readNoteState(env.instance, row.id);
    return createNoteBody(allowFold, unfolded === true, [
      row.segments.length
        ? h('div', { class: unfolded ? 'text open' : 'text' }, segments(row.segments, env))
        : null,
      mediaGrid(row.media, env, plainName(row.author), row.id, options?.queueImage),
      row.quotes.map((q) => quoteCard(q, env, row.id)),
      env.settings.get().linkPreviews ? linkCards(row.previews) : null,
    ]);
  };
  const warningChanged = (open: boolean): void => {
    if (open) fitNote(el);
    el.dispatchEvent(new Event('note-content-changed', { bubbles: true }));
  };
  const makeBody = (): HTMLElement =>
    row.face?.type === 'generic' ? genericBody(row, env, allowFold) : makeContent();
  const body = look?.compact
    ? compactBody(row, env)
    : row.cw !== undefined
      ? warned(row, env, covered, makeBody, warningChanged)
      : makeBody();
  const el = h(
    'article',
    {
      class: `note${threadClass(row)}${row.pending ? ' pending' : ''}`,
      'data-note': row.id,
      'data-send': deliveryMark(row) ?? null,
      'data-previews': row.previews?.length && !look?.compact ? row.id : null,
      'data-instance': env.instance,
    },
    context,
    h(
      'div',
      { class: 'nrow' },
      noteFace(row.author, env, options?.previous, options?.lazyFace),
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
    const face = noteFace(row.author, env, el);
    if (main.previousElementSibling !== face) main.previousElementSibling?.replaceWith(face);
  }
  // The button that was pressed is drawn again: the keyboard stays on its successor.
  const held = document.activeElement?.closest('.acts, .chips')?.parentElement === main;
  const mark = held ? heldMark(document.activeElement) : '';
  main.querySelector(':scope > .chips')?.remove();
  const compact = el.classList.contains('th-compact');
  const acts = actionRow(row, env, !compact);
  const old = main.querySelector(':scope > .acts');
  if (acts) old?.replaceWith(acts);
  else old?.remove();
  const chips = compact ? null : reactionChips(row, env);
  if (chips && acts) acts.after(chips);
  if (mark) main.querySelector<HTMLElement>(mark)?.focus({ preventScroll: true });
}

const heldMark = (el: Element | null): string => {
  const act = [...(el?.classList ?? [])].find((c) => c.startsWith('a-'));
  const emoji = el?.getAttribute('data-emoji');
  const url = el?.getAttribute('data-emoji-url') ?? '';
  return act
    ? `.acts > .${act}`
    : emoji
      ? `.chips > [data-emoji="${CSS.escape(emoji)}"][data-emoji-url="${CSS.escape(url)}"]`
      : '';
};
