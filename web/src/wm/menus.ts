// Single dropdown menu in the overlay layer; closes on outside pointerdown, Escape, a scroll or wheel anywhere,
// a window resize, or selection. Menus have no close button.
import { h } from '../shared/h.ts';

export type MenuItem = {
  readonly label: string;
  readonly run: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
};

export function openMenu(
  layer: HTMLElement,
  anchor: HTMLElement,
  items: readonly MenuItem[],
): void {
  const origin = layer.getBoundingClientRect();
  const a = anchor.getBoundingClientRect();
  const close = (): void => {
    menu.remove();
    window.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('scroll', close, true);
    window.removeEventListener('wheel', close, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('blur', close);
  };
  const outside = (e: PointerEvent): void => {
    if (!e.composedPath().includes(menu)) close();
  };
  const key = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') e.stopPropagation(), close();
  };
  const menu = h(
    'div',
    { class: 'menu', style: `left:${a.left - origin.left}px;top:${a.bottom - origin.top + 2}px` },
    items.length
      ? items.map((it) =>
          h(
            'button',
            {
              disabled: it.disabled === true,
              class: it.danger ? 'danger' : null,
              onclick: () => (close(), it.run()),
            },
            it.label,
          ),
        )
      : null,
  );
  layer.querySelector('.menu')?.remove();
  layer.append(menu);
  // The menu is zoomed by the UI scale, which also scales its own offsets: undo that.
  const zoom = Number(getComputedStyle(menu).zoom) || 1;
  menu.style.left = `${(a.left - origin.left) / zoom}px`;
  menu.style.top = `${(a.bottom - origin.top + 2) / zoom}px`;
  window.addEventListener('pointerdown', outside, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('scroll', close, true);
  window.addEventListener('wheel', close, { capture: true, passive: true });
  window.addEventListener('resize', close);
  window.addEventListener('blur', close);
  // Kept inside the window: a menu opened near the right or bottom edge moves back in.
  const m = menu.getBoundingClientRect();
  if (m.right > innerWidth - 4)
    menu.style.left = `${Math.max(4, innerWidth - 4 - m.width - origin.left) / zoom}px`;
  if (m.bottom > innerHeight - 4)
    menu.style.top = `${Math.max(4, a.top - m.height - 2 - origin.top) / zoom}px`;
}
