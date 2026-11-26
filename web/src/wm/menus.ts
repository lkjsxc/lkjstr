// One popover at a time in the overlay layer: a dropdown menu, or a panel such as the emoji picker. It closes on an
// outside press, Escape, a scroll or wheel outside it, a window blur, or a choice, and gives the keyboard back to
// what opened it. Menus have no close button. The page itself never scrolls (only a list does): when it does, the
// browser is lifting a field above an on-screen keyboard (iOS), and nothing closes.
import { h } from '../shared/h.ts';
import { pressed } from '../shared/keys.ts';

export type MenuItem = {
  readonly label: string;
  readonly run: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  /** The key that does the same, shown quietly at the right. */
  readonly key?: string;
  /** Drawn before the label (a face). */
  readonly lead?: HTMLElement;
  /** A second, quieter line under the label. */
  readonly sub?: string;
  /** A hairline above this item: it starts another group. */
  readonly sep?: boolean;
};
export type PopoverOpts = {
  /** A panel stays through a window resize (an on-screen keyboard opening) and is only put back in place. */
  readonly panel?: boolean;
  /** Its right edge on the anchor's (an anchor at the right of the bar), not its left. */
  readonly end?: boolean;
  readonly closed?: () => void;
};

let current: (() => void) | undefined;
/** A menu or panel is open: single keys belong to it, not to what is behind. */
export const popoverOpen = (): boolean => current !== undefined;

/** Shows `el` under `anchor` (above it when there is no room). Returns what closes it. */
export function openPopover(
  layer: HTMLElement,
  anchor: HTMLElement,
  el: HTMLElement,
  opts: PopoverOpts = {},
): () => void {
  current?.();
  // What had the keyboard when it opened (a list driven by keys, not the button a key pressed for it).
  const before = document.activeElement as HTMLElement | null;
  const inside = (e: Event): boolean =>
    e.composedPath().includes(el) ||
    (el.classList.contains('tsearch') && !!(e.target as Element).closest?.('[data-tab-search]'));
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
    const back = before?.isConnected && before !== document.body ? before : anchor;
    if (held && back.isConnected) back.focus({ preventScroll: true });
    opts.closed?.();
  };
  const outside = (e: PointerEvent): void => void (inside(e) || close());
  const away = (e: Event): void =>
    void (inside(e) || e.target === document || e.target === window || close());
  const key = (e: KeyboardEvent): void => {
    if (pressed(e, 'menuClose')) e.stopPropagation(), e.preventDefault(), close();
  };
  const place = (): void => {
    const origin = layer.getBoundingClientRect();
    const a = anchor.getBoundingClientRect();
    // The popover is zoomed by the UI scale, which also scales its own offsets: undo that.
    const zoom = Number(getComputedStyle(el).zoom) || 1;
    const m = el.getBoundingClientRect();
    const start = opts.end ? a.right - m.width : a.left;
    const left = Math.max(4, Math.min(start, innerWidth - 4 - m.width));
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
  opts: Pick<PopoverOpts, 'end'> = {},
): void {
  const menu = h(
    'div',
    { class: 'menu', role: 'menu' },
    items.flatMap((it) => [
      it.sep ? h('div', { class: 'msep', role: 'separator' }) : null,
      h(
        'button',
        {
          role: 'menuitem',
          disabled: it.disabled === true,
          class: it.danger ? 'danger' : null,
          onclick: () => (close(), it.run()),
        },
        it.lead ?? null,
        it.sub
          ? h('span', { class: 'mtext' }, it.label, h('span', { class: 'msub' }, it.sub))
          : it.label,
        it.key ? h('kbd', null, it.key) : null,
      ),
    ]),
  );
  // The keyboard is in the menu from the start: the arrows walk it, Enter chooses, Escape gives the keyboard back.
  const enabled = (): HTMLElement[] => [...menu.querySelectorAll<HTMLElement>('button:enabled')];
  menu.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    const all = enabled();
    if (!dir || !all.length) return;
    e.preventDefault();
    e.stopPropagation();
    const at = all.indexOf(document.activeElement as HTMLElement);
    all[(at + dir + all.length) % all.length]?.focus();
  });
  const close = openPopover(layer, anchor, menu, opts);
  enabled()[0]?.focus({ preventScroll: true });
}
