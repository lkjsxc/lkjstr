// A note, drawn from the engine's view model exactly as it arrives. A press on a person opens their profile, on
// the text or the time the note's thread, on a quoted card the quoted note: the same everywhere.
import type { NoteRow, Quote } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { type Child, h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { actionRow, reactionChips } from './note-actions.ts';
import { mediaGrid } from './note-media.ts';
import { displayName, faceButton, how, nameButton, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const timeOf = (at: number, env: ViewEnv): string =>
  noteTime(at, Date.now(), { relative: env.settings.get().relativeTime, lang: getLang() });

function quoteCard(q: Quote, env: ViewEnv): HTMLElement {
  if (q.state !== 'ok') return h('div', { class: 'quote muted' }, t(`quote.${q.state}`));
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
    q.cw !== undefined
      ? h('div', { class: 'muted' }, t('note.cw', { reason: q.cw }))
      : h('div', { class: 'qtext' }, segments(q.segments, env)),
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

/** Long text folds by whole lines; the button appears only when something is actually cut off. */
function fold(text: HTMLElement): void {
  if (text.scrollHeight <= text.clientHeight + 2) return;
  const more = h('button', { class: 'lnk fold' }, t('note.more'));
  more.addEventListener('click', (e) => {
    e.stopPropagation();
    text.classList.add('open');
    more.remove();
  });
  text.after(more);
}

const drawnBy = new WeakMap<HTMLElement, string>(); // the author each drawn note shows
/** The line over the text: name, NIP-05, time. One line of fixed height, whatever is known of the author. */
function head(row: NoteRow, env: ViewEnv): HTMLElement {
  const a = row.author;
  return h(
    'div',
    { class: 'nhead' },
    nameButton(a, env),
    a.nip05
      ? h(
          'span',
          {
            class: a.verified ? 'nip ok' : 'nip',
            title: a.verified ? t('nip05.ok') : t('nip05.unchecked'),
          },
          a.verified ? icon('check') : null,
          a.nip05,
        )
      : null,
    a.bot ? h('span', { class: 'badge' }, t('note.bot')) : null,
    h('time', { title: fullTime(row.at) }, row.pending ? t('note.sending') : timeOf(row.at, env)),
    // Where the tile is too narrow for a bookmark button, a set bookmark is this mark instead.
    h(
      'span',
      { class: 'bmark', title: t('note.bookmarked'), hidden: !row.mine.bookmarked },
      icon('bookmark'),
    ),
  );
}

export function renderNote(row: NoteRow, env: ViewEnv): HTMLElement {
  if (row.hidden) {
    const el = h(
      'div',
      { class: 'note hid muted' },
      t(`hidden.${row.hidden.reason === 'language' ? 'language' : 'other'}`),
      ' ',
    );
    el.append(
      h(
        'button',
        { class: 'lnk', onclick: () => el.replaceWith(fresh({ ...row, hidden: undefined })) },
        t('hidden.show'),
      ),
    );
    const fresh = (r: NoteRow): HTMLElement => {
      const n = renderNote(r, env);
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
  if (row.repostedBy) {
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
  if (row.replyTo)
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

  if (row.channel) {
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

  const covered = row.cw !== undefined && !env.settings.get().showSensitive;
  const text = h('div', { class: 'text' }, segments(row.segments, env));
  const content = h(
    'div',
    { class: 'content' },
    row.segments.length ? text : null,
    mediaGrid(row.media, env, plainName(row.author)),
    row.quotes.map((q) => quoteCard(q, env)),
  );
  let body: HTMLElement = content;
  if (covered) {
    body = h(
      'button',
      { class: 'cw' },
      t('note.cw', { reason: row.cw ?? '' }),
      h('span', { class: 'lnk' }, t('note.show')),
    );
    body.addEventListener('click', (e) => {
      e.stopPropagation();
      body.replaceWith(content);
      fold(text);
    });
  }
  const thread = row.thread;
  const el = h(
    'article',
    {
      class: `note${thread ? ` th-${thread.role}` : ''}${row.pending ? ' pending' : ''}`,
      style: thread?.depth ? `--depth:${thread.depth}` : null,
    },
    context,
    h(
      'div',
      { class: 'nrow' },
      faceButton(row.author, env),
      h(
        'div',
        { class: 'nmain' },
        head(row, env),
        body,
        actionRow(row, env),
        reactionChips(row, env),
      ),
    ),
  );
  drawnBy.set(el, JSON.stringify(row.author));
  const plain = (e: Event): boolean =>
    !(e.target as Element).closest('button, a, input, textarea, video, audio, .quote');
  el.addEventListener('click', (e) => void (plain(e) && openThread(e)));
  // A middle click opens the thread behind (and never starts the browser's autoscroll).
  el.addEventListener('mousedown', (e) => void (e.button === 1 && plain(e) && e.preventDefault()));
  el.addEventListener('auxclick', (e) => void (e.button === 1 && plain(e) && openThread(e)));
  return el;
}

/** The body of a note without what changes all the time (counts, reactions, the reader's own marks) and without
 * its author, whose name and picture arrive after the note does. */
export const bodySig = (row: NoteRow): string =>
  JSON.stringify({ ...row, author: 0, pending: 0, counts: 0, reactions: 0, mine: 0 });
/** Redraws only the author's line and face, the chips and the action row of a drawn note: the text stays as the
 * reader left it (unfolded, uncovered), pictures are not loaded again and nothing moves under the pointer. */
export function patchNote(el: HTMLElement, row: NoteRow, env: ViewEnv): void {
  const main = el.querySelector(':scope > .nrow > .nmain');
  if (!main) return;
  el.classList.toggle('pending', row.pending === true);
  const was = main.querySelector<HTMLElement>(':scope > .nhead');
  const name = was?.querySelector('.name');
  const keep = name !== null && name === document.activeElement;
  was?.replaceWith(head(row, env));
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
  const acts = actionRow(row, env);
  main.querySelector(':scope > .acts')?.replaceWith(acts);
  const chips = reactionChips(row, env);
  if (chips) acts.after(chips);
  if (mark) main.querySelector<HTMLElement>(mark)?.focus({ preventScroll: true });
}

const heldMark = (el: Element | null): string => {
  const act = [...(el?.classList ?? [])].find((c) => c.startsWith('a-'));
  const emoji = el?.getAttribute('data-emoji');
  return act ? `.acts > .${act}` : emoji ? `.chips > [data-emoji="${CSS.escape(emoji)}"]` : '';
};

/** After a note is in the document: fold what is too long. */
export function fitNote(el: HTMLElement): void {
  const text = el.querySelector<HTMLElement>('.content > .text');
  if (text && !el.querySelector('.fold')) fold(text);
}

export { displayName };
