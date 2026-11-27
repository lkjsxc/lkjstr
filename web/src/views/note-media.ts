// The pictures of a note. Every box has its final shape before anything loads (the size from the note's imeta
// when it gave one, a fixed ratio otherwise) and a quiet tint of its own in both themes, so a late image fills its
// place and never moves what is being read. A press opens the media tab right after the one being read, in the same
// tile; the address is still a real link, so a middle click opens the file itself.
import type { Media } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { loadImage, loadPlayable, mediaHost, mediaSource } from '../shared/media-source.ts';
import { readNoteState, writeNoteState } from '../shared/note-state.ts';
import { learnMediaSize, mediaSize } from '../shared/public-media.ts';
import { keepNoteAudio } from './note-audio.ts';
import type { NoteImageQueue } from './note-image-queue.ts';
import type { ViewEnv } from './registry.ts';

/** A picture of unknown size has loaded into its 3:2 box. The box keeps its height, so nothing below moves: a
 * narrower picture takes the box in to its own width, a wider one fills the box (cropped at the sides) unless it is
 * a strip, which stays whole. */
function settle(box: HTMLElement, img: HTMLImageElement): void {
  const r = img.naturalWidth / img.naturalHeight;
  const height = box.getBoundingClientRect().height;
  if (!Number.isFinite(r) || !height) return;
  if (r < 1.5) {
    box.style.height = `${height}px`;
    box.style.width = `${Math.max(height * r, 40)}px`;
    box.style.aspectRatio = 'auto';
  }
  if (r < 2.4) box.classList.remove('fit');
}

export function mediaGrid(
  media: readonly Media[],
  env: ViewEnv,
  title: string,
  noteId?: string,
  queueImage?: NoteImageQueue,
): HTMLElement | null {
  if (!media.length) return null;
  const one = media.length === 1;
  const cell = (m: Media, index: number): HTMLElement => {
    if (
      noteId &&
      m.sensitive &&
      !env.settings.get().showSensitive &&
      !readNoteState(env.instance, noteId).warning &&
      !readNoteState(env.instance, noteId).media?.includes(m.url)
    ) {
      const show = h('button', { class: 'mbox cw' }, t('media.reveal'));
      show.addEventListener('click', (e) => {
        e.stopPropagation();
        const seen = readNoteState(env.instance, noteId).media ?? [];
        writeNoteState(env.instance, noteId, { media: [...seen, m.url].slice(-16) });
        const revealed = cell(m, index);
        show.replaceWith(revealed);
        revealed.dispatchEvent(new Event('note-content-changed', { bubbles: true }));
      });
      return show;
    }
    // One picture keeps its own ratio (within reason) and is never drawn larger than it is; a picture of unknown
    // size gets a 3:2 box and is fitted into it whole. Several share a grid of squares.
    const size = m.w && m.h ? { w: m.w, h: m.h } : mediaSize(m.thumb ?? m.url);
    const sized = size !== undefined;
    const ratio = size ? Math.min(4, Math.max(0.4, size.w / size.h)) : 1.5;
    const style = one
      ? `--r:${ratio.toFixed(4)};${size ? `--w:${size.w}px;` : ''}`
      : 'aspect-ratio:1 / 1;';
    const box: HTMLElement = h('a', {
      class: one && !sized ? 'mbox fit' : 'mbox',
      href: m.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      style: `${style}${m.color ? `background:${m.color}` : ''}`,
      title: m.alt ?? '',
      'aria-label': m.alt || t('media.view'),
    });
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) return; // the browser's own "open in a new tab"
      e.preventDefault();
      env.open('media', { media, index, title }, { split: e.shiftKey, from: box });
    });
    // A file that cannot be had leaves its box in place, saying where it would have come from.
    const gone = (): void => {
      box.classList.add('gone');
      box.replaceChildren(h('span', { class: 'mgone' }, mediaHost(m.url)));
    };
    if (!mediaSource(m.url)) {
      gone();
      return box;
    }
    if (m.type === 'audio') {
      const audio = h('audio', {
        controls: true,
        preload:
          noteId && readNoteState(env.instance, noteId).audio?.[String(index)]
            ? 'metadata'
            : 'none',
      });
      const wrap = h('div', { class: 'mbox audio' }, audio);
      if (noteId) keepNoteAudio(audio, env, noteId, String(index));
      loadPlayable(audio, m.url, () => {
        gone();
        wrap.replaceWith(box);
      });
      return wrap;
    }
    if (m.type === 'image' || m.thumb) {
      const load = (): void => {
        const img = h('img', {
          alt: m.alt ?? '',
          loading: queueImage ? 'eager' : 'lazy',
          fetchpriority: 'low',
          decoding: 'async',
        });
        box.prepend(img);
        if (m.type === 'image') {
          img.addEventListener('load', () => {
            learnMediaSize(m.thumb ?? m.url, img.naturalWidth, img.naturalHeight);
            if (one && !sized) settle(box, img);
          });
        }
        loadImage(img, m.thumb ?? m.url, gone);
      };
      if (m.type !== 'image') box.append(h('span', { class: 'mplay' }, icon('play')));
      if (queueImage) queueImage(box, load);
      else load();
    } else {
      const video = h('video', {
        preload: 'metadata',
        muted: true,
        playsinline: true,
      });
      box.append(video, h('span', { class: 'mplay' }, icon('play')));
      loadPlayable(video, m.url, gone);
    }
    return box;
  };
  return h(
    'div',
    { class: `media n${Math.min(media.length, 4)}` },
    media.slice(0, 4).map(cell),
    media.length > 4 ? h('span', { class: 'mmore' }, `+${media.length - 4}`) : null,
  );
}
