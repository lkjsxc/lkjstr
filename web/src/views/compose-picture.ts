// A picture in a draft: pressed, it opens full size in a media tab, as a picture in a note does, with the draft's
// other pictures beside it. The address is still a real link, so a middle click opens the file itself.
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { loadImage } from '../shared/media-source.ts';
import type { ViewEnv } from './registry.ts';

export function draftPicture(
  env: ViewEnv,
  src: string,
  alt: string | undefined,
  all: () => { urls: readonly string[]; index: number },
): HTMLElement {
  const img = h('img', { alt: alt ?? '' });
  const box = h(
    'a',
    {
      class: 'tpic',
      href: src,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: t('media.view'),
      'aria-label': t('media.view'),
    },
    img,
  );
  loadImage(img, src, () => {
    box.hidden = true; // The file name remains available when its picture cannot be drawn.
  });
  box.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) return; // the browser's own "open in a new tab"
    e.preventDefault();
    const { urls, index } = all();
    if (index === -1) return;
    const media = urls.map((url) => ({ type: 'image' as const, url }));
    env.open('media', { media, index }, { split: e.shiftKey, from: box });
  });
  return box;
}
