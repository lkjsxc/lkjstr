// One popover at a time in the overlay layer: a dropdown menu, or a panel such as the emoji picker. It closes on an
// outside press, Escape, a scroll or wheel outside it, a window blur, or a choice, and gives the keyboard back to
// what opened it. Menus have no close button.
import { h } from '../shared/h.ts';
import { pressed } from '../shared/keys.ts';

export type MenuItem = {
  readonly label: string;
  readonly run: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  /** The key that does the same, shown quietly at the right. */
  readonly key?: string;
};
export type PopoverOpts = {
  /** A panel stays through a window resize (an on-screen keyboard opening) and is only put back in place. */
  readonly panel?: boolean;
  readonly closed?: () => void;
};

let current: (() => void) | undefined;

/** Shows `el` under `anchor` (above it when there is no room). Returns what closes it. */
export function openPopover(
  layer: HTMLElement,
  anchor: HTMLElement,
  el: HTMLElement,
  opts: PopoverOpts = {},
): () => void {
  current?.();
  const inside = (e: Event): boolean => e.composedPath().includes(el);
  const close = (): void => {
    if (current !== close) return;
    current = undefined;
    const held = el.contains(document.activeElement) || document.activeElement === document.body;
    el.remove();
    window.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('scroll', away, true);
    window.removeEventListener('wheel', away, true);
    window.removeEventListener('resize', resized);
    window.removeEventListener('blur', close);
    if (held && anchor.isConnected) anchor.focus({ preventScroll: true });
    opts.closed?.();
  };
  const outside = (e: PointerEvent): void => void (inside(e) || close());
  const away = (e: Event): void => void (inside(e) || close());
  const key = (e: KeyboardEvent): void => {
    if (pressed(e, 'menuClose')) e.stopPropagation(), e.preventDefault(), close();
  };
  const place = (): void => {
    const origin = layer.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    // The popover is zoomed by the UI scale, which also scales its own offsets: undo that.
    const zoom = Number(getComputedStyle(el).zoom) || 1;
    const m = el.getBoundingClientRect();
    const left = Math.max(4, Math.min(a.left, innerWidth - 4 - m.width));
    const below = a.bottom + 2;
    const top = below + m.height <= innerHeight - 4 ? below : Math.max(4, a.top - m.height - 2);
    el.style.left = `${(left - origin.left) / zoom}px`;
    el.style.top = `${(top - origin.top) / zoom}px`;
  };
  const resized = (): void => (opts.panel ? place() : close());
  el.style.left = el.style.top = '0';
  layer.append(el);
  place();
  current = close;
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('keydown', key, true);
  // A scroll that ended just before the press still reports in this frame: it is not a reason to close.
  requestAnimationFrame(() => {
    if (current === close) window.addEventListener('scroll', away, true);
  });
  window.addEventListener('wheel', away, { capture: true, passive: true });
  window.addEventListener('resize', resized);
  window.addEventListener('blur', close);
  return close;
}

export function openMenu(
  layer: HTMLElement,
  anchor: HTMLElement,
  items: readonly MenuItem[],
): void {
  const menu = h(
    'div',
    { class: 'menu', role: 'menu' },
    items.map((it) =>
      h(
        'button',
        {
          role: 'menuitem',
          disabled: it.disabled === true,
          class: it.danger ? 'danger' : null,
          onclick: () => (close(), it.run()),
        },
        it.label,
        it.key ? h('kbd', null, it.key) : null,
      ),
    ),
  );
  const close = openPopover(layer, anchor, menu);
}
