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

export type NoteStyle = { readonly dated: boolean };

const timeOf = (at: number, env: ViewEnv, dated: boolean): string =>
  noteTime(at, Date.now(), { relative: env.settings.get().relativeTime, lang: getLang(), dated });

/** Pictures in boxes whose shape is known before they load, so nothing below ever moves. */
export function mediaGrid(media: readonly Media[]): HTMLElement | null {
  if (!media.length) return null;
  const one = media.length === 1;
  const cell = (m: Media): HTMLElement => {
    const ratio = one && m.w && m.h ? `${m.w} / ${m.h}` : one ? '16 / 9' : '1 / 1';
    const box = h('a', {
      class: 'mbox',
      href: m.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      style: `aspect-ratio:${ratio};background:${m.color ?? 'var(--raised)'}`,
      title: m.alt ?? '',
      onclick: (e) => e.stopPropagation(),
    });
    if (m.type === 'image')
      box.append(
        h('img', { src: m.thumb ?? m.url, alt: m.alt ?? '', loading: 'lazy', decoding: 'async' }),
      );
    else if (m.type === 'video')
      box.append(h('video', { src: m.url, controls: true, preload: 'none' }));
    else box.append(h('audio', { src: m.url, controls: true, preload: 'none' }));
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
      h('time', { title: fullTime(q.at) }, timeOf(q.at, env, false)),
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

export function renderNote(row: NoteRow, env: ViewEnv, style: NoteStyle): HTMLElement {
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
      const n = renderNote(r, env, style);
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
    mediaGrid(row.media),
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
            row.pending ? t('note.sending') : timeOf(row.at, env, style.dated),
          ),
        ),
        body,
        reactionChips(row, env),
        actionRow(row, env),
      ),
    ),
  );
  el.addEventListener('click', (e) => {
    if ((e.target as Element).closest('button, a, input, textarea, video, audio')) return;
    openThread(e);
  });
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
  main.querySelector(':scope > .chips')?.remove();
  main.querySelector(':scope > .acts')?.remove();
  const chips = reactionChips(row, env);
  if (chips) main.append(chips);
  main.append(actionRow(row, env));
}

/** After a note is in the document: fold what is too long. */
export function fitNote(el: HTMLElement): void {
  const text = el.querySelector<HTMLElement>('.content > .text');
  if (text && !el.querySelector('.fold')) fold(text);
}

export { displayName };
