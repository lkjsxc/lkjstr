import type { Subscription } from '../engine/client.ts';

/** Pixels only: supply near, uncovered ids to the engine. Hiding and unmounting release all wants. */
export function createPreviewWants(
  el: HTMLElement,
  sub: () => Subscription | undefined,
): { sync(): void; dispose(): void } {
  let frame = 0;
  let previous = '';
  const read = (): void => {
    frame = 0;
    const bounds = el.getBoundingClientRect();
    const ids = bounds.height
      ? [...el.querySelectorAll<HTMLElement>('[data-previews]')]
          .filter((n) => {
            const rect = n.getBoundingClientRect();
            return (
              !!n.querySelector('.content') &&
              rect.bottom >= bounds.top - 400 &&
              rect.top <= bounds.bottom + 400
            );
          })
          .map((n) => n.dataset.note ?? '')
          .filter(Boolean)
          .slice(0, 32)
      : [];
    const sig = `${sub()?.id}:${ids.join()}`;
    if (sig !== previous) {
      previous = sig;
      sub()?.near(ids);
    }
  };
  const sync = (): void => {
    if (!frame) frame = requestAnimationFrame(read);
  };
  el.addEventListener('scroll', sync, { passive: true });
  el.addEventListener('note-revealed', sync);
  const sizes = new ResizeObserver(sync);
  sizes.observe(el);
  return {
    sync,
    dispose: () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      el.removeEventListener('scroll', sync);
      el.removeEventListener('note-revealed', sync);
      sub()?.near([]);
    },
  };
}
