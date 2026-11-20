// An emoji in a note, a name or a reaction says what it is: under the pointer after a moment, while it or its
// reaction button has the keyboard, or under a resting finger, a small popover shows it large. A custom emoji shows
// its picture and `:code:`; a Unicode one its name in the reader's language and its shortcode, from the Unicode
// table, which is asked for when the first emoji is approached. Until the table is here (or when it cannot be had)
// the popover shows the emoji alone, and takes the name when it comes only if it still shows that emoji. It takes
// no pointer events and closes on any press, scroll or key, so it never stands between the reader and a click.
import { emojiTable, emojiTableNow, glyphFor } from '../shared/emoji-table.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { pictureOf } from './emoji-load.ts';
import { describe, onLongPress } from './emoji-preview.ts';

const EMOJI = 'img.emo, .uemo';
const CHIP = '.rchip, .act-chip';
/** Controls that take the keyboard for the emoji inside them, which have no tab stop of their own: a reaction chip,
 * a name, a mention, a notification's excerpt. With the keyboard on one, the popover shows its first emoji. */
const HOLDER = `${CHIP}, .name, .lnk, .excerpt`;
const DELAY = 300;

export function installEmojiPeek(layer: HTMLElement): void {
  // In the layer only while shown: an empty layer means nothing floats.
  const el = h('div', { class: 'epeek', 'aria-hidden': 'true' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let over: Element | undefined;
  /** What showed it: only the keyboard's popover follows the focus. */
  let by: 'pointer' | 'finger' | 'key' = 'pointer';
  let shown: HTMLElement | undefined;

  const hide = (): void => {
    clearTimeout(timer);
    timer = undefined;
    over = shown = undefined;
    el.remove();
  };
  const place = (img: HTMLElement): void => {
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
  const draw = (img: HTMLElement): void => {
    if (img instanceof HTMLImageElement)
      return replaceChildren(el, describe({ picked: { emoji: img.alt, url: pictureOf(img) } }, 0));
    const emoji = img.textContent ?? '';
    const known = glyphFor(emoji);
    replaceChildren(el, describe({ picked: { emoji }, glyph: known?.glyph }, known?.tone ?? 0));
  };
  const show = (img: HTMLElement, how: typeof by): void => {
    clearTimeout(timer);
    by = how;
    if (!img.isConnected) return;
    draw(img);
    layer.append(el);
    shown = img;
    place(img);
    if (img instanceof HTMLImageElement || emojiTableNow()) return;
    // The name comes with the table: drawn only over the emoji that asked for it, never over a later one.
    void emojiTable().then(() => {
      if (shown !== img || !el.isConnected || !img.isConnected || !glyphFor(img.textContent ?? ''))
        return;
      draw(img);
      place(img);
    });
  };
  const emojiIn = (node: EventTarget | null, holders = CHIP): HTMLElement | null => {
    const e = node as Element | null;
    return (
      e?.closest?.<HTMLElement>(EMOJI) ??
      e?.closest?.(holders)?.querySelector<HTMLElement>(EMOJI) ??
      null
    );
  };

  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const img = (e.target as Element).closest?.<HTMLElement>(EMOJI);
    if (!img || img === over) return;
    hide();
    over = img;
    if (!(img instanceof HTMLImageElement)) emojiTableNow(); // its name is on the way while the pointer rests
    timer = setTimeout(() => show(img, 'pointer'), DELAY);
  });
  document.addEventListener('pointerout', (e) => {
    if (!over || e.pointerType === 'touch') return;
    if (!(e.relatedTarget instanceof Node && over.contains(e.relatedTarget))) hide();
  });
  // The keyboard reaches an emoji that stands alone, or a reaction chip, a name or a mention that holds one.
  document.addEventListener('focusin', (e) => {
    const img = emojiIn(e.target, HOLDER);
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
  // Focus scrolls what it reaches into view: the keyboard's popover follows its emoji; any other goes.
  const scrolled = (): void => {
    if (!el.isConnected) return;
    if (by === 'key' && shown?.isConnected) place(shown);
    else hide();
  };
  window.addEventListener('scroll', scrolled, {
    capture: true,
    passive: true,
  });
  window.addEventListener('wheel', () => void (!el.isConnected || hide()), {
    capture: true,
    passive: true,
  });
  window.addEventListener('blur', hide);
}
