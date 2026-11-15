import type { LinkPreview } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';

const observers = new WeakMap<HTMLElement, ResizeObserver>();
export const disposeLinkCards = (root: HTMLElement): void => {
  for (const card of root.querySelectorAll<HTMLElement>('.link-card'))
    observers.get(card)?.disconnect();
};

/** Render only the engine's view model. Fixed height from loading to failure. */
export function linkCards(cards: readonly LinkPreview[] | undefined): HTMLElement[] {
  return (cards ?? []).slice(0, 2).flatMap((card) => {
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
    const picture =
      card.imageUrl && /^(https?:\/\/|data:image\/)/.test(card.imageUrl)
        ? h('img', {
            class: 'lcpicture',
            src: card.imageUrl,
            alt: '',
            loading: 'lazy',
            decoding: 'async',
            referrerpolicy: 'no-referrer',
          })
        : null;
    picture?.addEventListener('error', () => picture.remove());
    const link = h(
      'a',
      {
        class: `link-card${card.kind === 'loading' ? ' loading' : ''}`,
        href: card.source,
        target: '_blank',
        rel: 'noopener noreferrer',
        title,
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
