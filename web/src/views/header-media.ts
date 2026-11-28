// A header picture is a media-tab opener only while it has a usable original.
import type { Author } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { loadImage, mediaSource } from '../shared/media-source.ts';
import { avatar, avatarModel } from './avatars.ts';
import type { ViewEnv } from './registry.ts';

function originalUrl(value?: string): string | undefined {
  if (!value || !mediaSource(value)) return;
  const url = new URL(value, location.href);
  // Image sources can also be data/blob URLs; do not expose those as navigable originals.
  if (url.protocol === 'http:' || url.protocol === 'https:') return value;
}

/** Keep the face itself mounted, so wrapping it never creates another avatar lease. */
function mediaLink(content: HTMLElement, env: ViewEnv, title: () => string) {
  let link: HTMLAnchorElement | undefined;
  return (value?: string): void => {
    const url = originalUrl(value);
    if (!url) {
      if (link) link.replaceWith(content);
      link = undefined;
      return;
    }
    if (!link) {
      const a = h('a', {
        class: 'header-media',
        target: '_blank',
        rel: 'noopener noreferrer',
      });
      a.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        const url = a.getAttribute('href')!;
        const name = title();
        env.open(
          'media',
          { media: [{ type: 'image', url, alt: name }], index: 0, title: name },
          { split: e.shiftKey, from: a },
        );
      });
      a.addEventListener('auxclick', (e) => e.stopPropagation());
      content.replaceWith(a);
      a.append(content);
      link = a;
    }
    link.setAttribute('href', url);
    link.title = title();
    link.setAttribute('aria-label', link.title);
  };
}

export function headerAvatar(
  author: Author,
  cls: string,
  env: ViewEnv,
  title: (author: Author) => string,
): HTMLElement {
  const face = avatar(author, cls, { onImage: (url) => setLink(url) });
  const wrap = h('span', { class: 'header-face' }, face);
  const setLink = mediaLink(face, env, () => title(avatarModel(face) ?? author));
  return wrap;
}

export function headerBanner(url: string | undefined, env: ViewEnv, title: string): HTMLElement {
  const banner = h('div', { class: 'banner' });
  if (!url) return banner;
  const img = h('img', { alt: '', decoding: 'async', 'data-picture': url });
  banner.append(img);
  const setLink = mediaLink(img, env, () => title);
  img.addEventListener('load', () => setLink(url), { once: true });
  loadImage(img, url, () => {
    setLink();
    img.remove();
  });
  return banner;
}
