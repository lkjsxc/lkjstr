import type { LinkPreview } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { loadImage } from '../shared/media-source.ts';

const observers = new WeakMap<HTMLElement, ResizeObserver>();
export const disposeLinkCards = (root: HTMLElement): void => {
  for (const card of root.querySelectorAll<HTMLElement>('.link-card'))
    observers.get(card)?.disconnect();
};

/** Loading reserves space; failed or untitled answers leave only the link in the text. */
export function linkCards(cards: readonly LinkPreview[] | undefined): HTMLElement[] {
  const seen = new Set<string>(); // bound: at most two engine-projected cards
  return (cards ?? [])
    .filter((card) => {
      if (seen.has(card.source)) return false;
      seen.add(card.source);
      return card.kind === 'loading' || (card.kind !== 'link' && Boolean(card.title?.trim()));
    })
    .slice(0, 2)
    .flatMap((card) => {
      let url: URL;
      try {
        url = new URL(card.source);
      } catch {
        return [];
      }
      if (!['http:', 'https:'].includes(url.protocol)) return [];
      const title = card.title || `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
      const heading = h('b', { class: 'lctitle' }, title);
      const description = h('span', { class: 'lcdesc' }, card.description ?? '');
      let picture =
        card.imageUrl && /^(https?:\/\/|data:image\/)/.test(card.imageUrl)
          ? h('img', {
              class: 'lcpicture',
              alt: '',
              loading: 'lazy',
              fetchpriority: 'low',
              decoding: 'async',
              referrerpolicy: 'no-referrer',
            })
          : null;
      if (picture && card.imageUrl) {
        const img = picture;
        loadImage(
          img,
          card.imageUrl,
          () => {
            picture = null;
            img.remove();
          },
          undefined,
          { class: 'media', slot: 'link-picture', lane: 'Unknown' },
        );
      }
      const link = h(
        'a',
        {
          class: `link-card${card.kind === 'loading' ? ' loading' : ''}`,
          href: card.source,
          target: '_blank',
          rel: 'noopener noreferrer',
          title: `${card.siteName || url.host}\n${title}`,
          'aria-label': title,
          onclick: (e) => e.stopPropagation(),
        },
        picture,
        h(
          'span',
          { class: 'lcwords' },
          h('span', { class: 'lcsite' }, card.siteName || url.host),
          heading,
          description,
        ),
      );
      // CSS line clamping sets the limit; measuring the title decides whether description has room.
      const observer = new ResizeObserver(() => {
        description.hidden = heading.getBoundingClientRect().height > 24;
      });
      observer.observe(heading);
      observers.set(link, observer);
      return [link];
    });
}
