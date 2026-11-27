// Pins have local reading positions; only the surrounding profile header is an ordinary feed anchor.
import type { Keeper, Place } from './feed-place.ts';

export function createPinPosition(
  root: HTMLElement,
  list: HTMLElement,
  parent: Keeper,
  visible: () => boolean,
) {
  let header: HTMLElement | undefined;
  let place: Place | undefined;
  let firstPage = false;
  const children = () => [...list.children] as HTMLElement[]; // Bound: the finite pin window.
  const available = () => visible() && list.isConnected && root.clientHeight > 0;
  const candidates = (): Place[] => {
    if (!available() || root.scrollTop < 8) return [];
    const view = root.getBoundingClientRect();
    const bounds = list.getBoundingClientRect();
    // Chronological rows and the profile's biography retain the ordinary feed keeper.
    if (bounds.top > view.top + 1 || bounds.bottom <= view.top + 1) return [];
    return children().flatMap((node) => {
      const box = node.getBoundingClientRect();
      const key = node.dataset.key;
      return key && box.bottom > view.top + 1 && box.top < view.bottom
        ? [{ key, off: box.top - view.top }]
        : [];
    });
  };
  const capture = (): void => {
    if (available()) place = candidates()[0];
  };
  const adjust = (target: Place): boolean => {
    if (!available()) return false;
    const node = children().find((child) => child.dataset.key === target.key);
    if (!node) return false;
    const view = root.getBoundingClientRect();
    const delta = node.getBoundingClientRect().top - view.top - target.off;
    if (Math.abs(delta) >= 0.5) {
      const key = header?.dataset.key;
      if (key && header?.isConnected) {
        // One keeper owns scrolling and its in-flight gesture shift; teach it the desired header offset.
        parent.set({ key, off: header.getBoundingClientRect().top - view.top - delta });
      } else root.scrollTop += delta;
    }
    return true;
  };
  const settle = (): void => {
    if (place && available()) {
      adjust(place);
      capture();
    }
  };
  const sizes = new ResizeObserver(settle);
  sizes.observe(list);
  sizes.observe(root);
  root.addEventListener('scroll', capture, { passive: true });
  return {
    capture,
    page: () => {
      firstPage = true;
    },
    reset: () => {
      place = undefined;
      firstPage = false;
    },
    hold(): () => void {
      const held = candidates();
      return () => {
        const first = children()[0]?.dataset.key;
        const kept = firstPage && first ? adjust({ key: first, off: 0 }) : held.some(adjust);
        firstPage = false;
        if (kept) capture();
        else place = undefined;
      };
    },
    seat(next: HTMLElement) {
      if (header === next) return;
      if (header) sizes.unobserve(header);
      header = next;
      // An outer header redraw settles first; its initial observation then restores a pin being read.
      sizes.observe(header);
    },
    dispose() {
      sizes.disconnect();
      root.removeEventListener('scroll', capture);
    },
  };
}
