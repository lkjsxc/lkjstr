// A note, drawn from the engine's view model exactly as it arrives. A press on a person opens their profile, on
// the text or the time the note's thread, on a quoted card the quoted note: the same everywhere.
import type { Media, NoteRow, Quote } from '../engine/protocol.ts';
import { fullTime, noteTime } from '../shared/format.ts';
import { type Child, h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { actionRow, reactionChips } from './note-actions.ts';
import { avatar, displayName, how, nameButton, plainName, segments } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const timeOf = (at: number, env: ViewEnv): string =>
  noteTime(at, Date.now(), { relative: env.settings.get().relativeTime, lang: getLang() });

/** Pictures in boxes whose shape is known before they load, so nothing below ever moves. A press opens the media
 * tab beside the note (the address is still a real link: a middle click opens the file itself). */
export function mediaGrid(
  media: readonly Media[],
  env: ViewEnv,
  title: string,
): HTMLElement | null {
  if (!media.length) return null;
  const one = media.length === 1;
  const cell = (m: Media, index: number): HTMLElement => {
    const ratio = one && m.w && m.h ? `${m.w} / ${m.h}` : one ? '16 / 9' : '1 / 1';
    const style = `aspect-ratio:${ratio};background:${m.color ?? 'var(--raised)'}`;
    if (m.type === 'audio')
      return h(
        'div',
        { class: 'mbox audio' },
        h('audio', { src: m.url, controls: true, preload: 'none' }),
      );
    const box: HTMLElement = h('a', {
      class: 'mbox',
      href: m.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      style,
      title: m.alt ?? '',
      'aria-label': m.alt || t('media.view'),
    });
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) return; // the browser's own "open in a new tab"
      e.preventDefault();
      env.open('media', { media, index, title }, { beside: true, split: e.shiftKey, from: box });
    });
    if (m.type === 'image')
      box.append(
        h('img', { src: m.thumb ?? m.url, alt: m.alt ?? '', loading: 'lazy', decoding: 'async' }),
      );
    else
      box.append(
        h('video', { src: m.url, preload: 'metadata', muted: true, playsinline: true }),
        h('span', { class: 'mplay' }, icon('play')),
      );
    return box;
  };
  return h(
    'div',
    { class: `media n${Math.min(media.length, 4)}` },
    media.slice(0, 4).map(cell),
    media.length > 4 ? h('span', { class: 'mmore' }, `+${media.length - 4}`) : null,
  );
}

function quoteCard(q: Quote, env: ViewEnv): HTMLElement {
  if (q.state !== 'ok') return h('div', { class: 'quote muted' }, t(`quote.${q.state}`));
  const el = h(
    'div',
    { class: 'quote', role: 'link', tabindex: 0 },
    h(
      'div',
      { class: 'qhead' },
      avatar(q.author, 'av sm'),
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
  const person = (e: MouseEvent): void => {
    e.stopPropagation();
    env.open('profile', { pubkey: row.author.pubkey, title: plainName(row.author) }, how(e));
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
  const av = h(
    'button',
    { class: 'avb', title: plainName(row.author), 'aria-label': plainName(row.author) },
    avatar(row.author),
  );
  av.addEventListener('click', person);
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
      av,
      h(
        'div',
        { class: 'nmain' },
        h(
          'div',
          { class: 'nhead' },
          nameButton(row.author, env),
          row.author.nip05
            ? h(
                'span',
                {
                  class: row.author.verified ? 'nip ok' : 'nip',
                  title: row.author.verified ? t('nip05.ok') : t('nip05.unchecked'),
                },
                row.author.verified ? icon('check') : null,
                row.author.nip05,
              )
            : null,
          row.author.bot ? h('span', { class: 'badge' }, t('note.bot')) : null,
          h(
            'time',
            { title: fullTime(row.at) },
            row.pending ? t('note.sending') : timeOf(row.at, env),
          ),
          // Where the tile is too narrow for a bookmark button, a set bookmark is this mark instead.
          h(
            'span',
            { class: 'bmark', title: t('note.bookmarked'), hidden: !row.mine.bookmarked },
            icon('bookmark'),
          ),
        ),
        body,
        actionRow(row, env),
        reactionChips(row, env),
      ),
    ),
  );
  const plain = (e: Event): boolean =>
    !(e.target as Element).closest('button, a, input, textarea, video, audio, .quote');
  el.addEventListener('click', (e) => void (plain(e) && openThread(e)));
  // A middle click opens the thread behind (and never starts the browser's autoscroll).
  el.addEventListener('mousedown', (e) => void (e.button === 1 && plain(e) && e.preventDefault()));
  el.addEventListener('auxclick', (e) => void (e.button === 1 && plain(e) && openThread(e)));
  return el;
}

/** The body of a note without what changes all the time (counts, reactions, the reader's own marks). */
export const bodySig = (row: NoteRow): string =>
  JSON.stringify({ ...row, counts: 0, reactions: 0, mine: 0 });
/** Redraws only the chips and the action row of a drawn note: the text stays as the reader left it (unfolded,
 * uncovered) and nothing moves under the pointer. */
export function patchNote(el: HTMLElement, row: NoteRow, env: ViewEnv): void {
  const main = el.querySelector(':scope > .nrow > .nmain');
  if (!main) return;
  main.querySelector(':scope > .nhead > .bmark')?.toggleAttribute('hidden', !row.mine.bookmarked);
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
