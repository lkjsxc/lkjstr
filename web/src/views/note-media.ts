// The pictures of a note. Every box has its final shape before anything loads (the size from the note's imeta
// when it gave one, a fixed ratio otherwise) and a quiet tint of its own in both themes, so a late image fills its
// place and never moves what is being read. A press opens the media tab beside the note; the address is still a
// real link, so a middle click opens the file itself.
import type { Media } from '../engine/protocol.ts';
import { hostOf } from '../shared/address.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import type { ViewEnv } from './registry.ts';

/** Sizes learned from pictures that have loaded here: the next time one is drawn its box is exact from the start. */
const seen = new Map<string, { w: number; h: number }>(); // bound: SEEN_MAX, oldest dropped
const SEEN_MAX = 600;
const learn = (url: string, w: number, h: number): void => {
  if (!w || !h) return;
  if (seen.size >= SEEN_MAX) seen.delete(seen.keys().next().value ?? '');
  seen.set(url, { w, h });
};
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
): HTMLElement | null {
  if (!media.length) return null;
  const one = media.length === 1;
  const cell = (m: Media, index: number): HTMLElement => {
    if (m.type === 'audio')
      return h(
        'div',
        { class: 'mbox audio' },
        h('audio', { src: m.url, controls: true, preload: 'none' }),
      );
    // One picture keeps its own ratio (within reason) and is never drawn larger than it is; a picture of unknown
    // size gets a 3:2 box and is fitted into it whole. Several share a grid of squares.
    const size = m.w && m.h ? { w: m.w, h: m.h } : seen.get(m.thumb ?? m.url);
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
      env.open('media', { media, index, title }, { beside: true, split: e.shiftKey, from: box });
    });
    // A file that cannot be had leaves its box in place, saying where it would have come from.
    const gone = (el: HTMLElement) => (): void => {
      el.remove();
      box.classList.add('gone');
      box.append(h('span', { class: 'mgone' }, hostOf(m.url).split('/')[0] ?? ''));
    };
    if (m.type === 'image') {
      const img = h('img', {
        src: m.thumb ?? m.url,
        alt: m.alt ?? '',
        loading: 'lazy',
        decoding: 'async',
      });
      img.addEventListener('error', gone(img));
      if (one && !sized)
        img.addEventListener('load', () => {
          learn(img.src, img.naturalWidth, img.naturalHeight);
          settle(box, img);
        });
      box.append(img);
    } else {
      const video = h('video', {
        src: m.url,
        poster: m.thumb ?? null,
        preload: 'metadata',
        muted: true,
        playsinline: true,
      });
      video.addEventListener('error', gone(video));
      box.append(video, h('span', { class: 'mplay' }, icon('play')));
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
