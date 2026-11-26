import type { Subscription } from '../engine/client.ts';

/** Pixels only: supply near, uncovered ids to the engine. Hiding and unmounting release all wants. */
export function createPreviewWants(
  el: HTMLElement,
  sub: () => Pick<Subscription, 'id' | 'near'> | undefined,
): { sync(): void; dispose(): void } {
  let frame = 0;
  let previous = '';
  const read = (): void => {
    frame = 0;
    const bounds = el.getBoundingClientRect();
    const ids = new Set<string>(); // bound: the engine accepts at most 32 near IDs per view
    if (bounds.height)
      for (const n of el.querySelectorAll<HTMLElement>('[data-previews]')) {
        const id = n.dataset.previews;
        if (!id || ids.has(id) || (n.matches('.note') && !n.querySelector('.content'))) continue;
        const rect = n.getBoundingClientRect();
        const fold = n.closest('.content.folded');
        if (fold && rect.top >= fold.getBoundingClientRect().bottom) continue;
        if (rect.height > 0 && rect.bottom >= bounds.top - 400 && rect.top <= bounds.bottom + 400)
          ids.add(id);
        if (ids.size === 32) break;
      }
    const near = [...ids];
    const current = sub();
    const sig = `${current?.id}:${near.join()}`;
    if (sig !== previous) {
      previous = sig;
      current?.near(near);
    }
  };
  const sync = (): void => {
    if (!frame) frame = requestAnimationFrame(read);
  };
  el.addEventListener('scroll', sync, { passive: true });
  el.addEventListener('note-content-changed', sync);
  const sizes = new ResizeObserver(sync);
  sizes.observe(el);
  return {
    sync,
    dispose: () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      el.removeEventListener('scroll', sync);
      el.removeEventListener('note-content-changed', sync);
      sub()?.near([]);
    },
  };
}
