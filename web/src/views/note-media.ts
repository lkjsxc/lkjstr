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
    const sized = Boolean(m.w && m.h);
    const ratio = sized ? Math.min(4, Math.max(0.4, (m.w ?? 3) / (m.h ?? 2))) : 1.5;
    const style = one
      ? `--r:${ratio.toFixed(4)};${sized ? `--w:${m.w}px;` : ''}`
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
