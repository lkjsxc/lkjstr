// A custom emoji in a note, a name or a reaction says what it is: under the pointer after a moment, while its reaction
// has the keyboard, or under a resting finger, a small popover shows the picture large with its `:code:`. It takes
// no pointer events and closes on any press, scroll or key, so it never stands between the reader and a click.
import { h, replaceChildren } from '../shared/h.ts';
import { describe, onLongPress } from './emoji-preview.ts';

const EMOJI = 'img.emo';
const CHIP = '.rchip, .act-chip';
const DELAY = 300;

export function installEmojiPeek(layer: HTMLElement): void {
  // In the layer only while shown: an empty layer means nothing floats.
  const el = h('div', { class: 'epeek', 'aria-hidden': 'true' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let over: Element | undefined;
  /** What showed it: only the keyboard's popover follows the focus. */
  let by: 'pointer' | 'finger' | 'key' = 'pointer';

  const hide = (): void => {
    clearTimeout(timer);
    timer = undefined;
    over = undefined;
    el.remove();
  };
  const show = (img: HTMLImageElement, how: typeof by): void => {
    clearTimeout(timer);
    by = how;
    if (!img.isConnected) return;
    replaceChildren(
      el,
      describe({ picked: { emoji: img.alt, url: img.currentSrc || img.src } }, 0),
    );
    layer.append(el);
    const origin = layer.getBoundingClientRect();
    const zoom = Number(getComputedStyle(el).zoom) || 1;
    const a = img.getBoundingClientRect();
    const m = el.getBoundingClientRect();
    const left = Math.max(
      4,
      Math.min(a.left + a.width / 2 - m.width / 2, innerWidth - 4 - m.width),
    );
    const above = a.top - m.height - 6;
    const top = above >= 4 ? above : Math.min(a.bottom + 6, innerHeight - 4 - m.height);
    el.style.left = `${(left - origin.left) / zoom}px`;
    el.style.top = `${(top - origin.top) / zoom}px`;
  };
  const emojiIn = (node: EventTarget | null): HTMLImageElement | null => {
    const e = node as Element | null;
    return (
      e?.closest?.<HTMLImageElement>(EMOJI) ??
      e?.closest?.(CHIP)?.querySelector<HTMLImageElement>(EMOJI) ??
      null
    );
  };

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const img = (e.target as Element).closest?.<HTMLImageElement>(EMOJI);
    if (!img || img === over) return;
    hide();
    over = img;
    timer = setTimeout(() => show(img, 'pointer'), DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    if (!over || e.pointerType === 'touch') return;
    if (!(e.relatedTarget instanceof Node && over.contains(e.relatedTarget))) hide();
  });
  document.addEventListener('focusin', (e) => {
    const chip = (e.target as Element).closest?.(CHIP);
    const img = chip?.querySelector<HTMLImageElement>(EMOJI);
    if (img && (e.target as Element).matches(':focus-visible')) show(img, 'key');
    else if (el.isConnected && by === 'key') hide();
  });
  document.addEventListener('focusout', () => void (!el.isConnected || by !== 'key' || hide()));
  onLongPress(document, `${EMOJI}, ${CHIP}`, (target) => {
    const img = emojiIn(target);
    if (img) show(img, 'finger');
  });
  // A press starts the next thing: the popover of the last one goes (a finger's stays until then).
  document.addEventListener('pointerdown', () => void (!el.isConnected || hide()), true);
  document.addEventListener('keydown', () => void (!el.isConnected || hide()), true);
  window.addEventListener('scroll', () => void (!el.isConnected || hide()), {
    capture: true,
    passive: true,
  });
  window.addEventListener('wheel', () => void (!el.isConnected || hide()), {
    capture: true,
    passive: true,
  });
  window.addEventListener('blur', hide);
}
