// What an emoji is, large, with its name and shortcode: the strip at the foot of the picker (a fixed space, so the grid
// never moves) and the small popover over a custom emoji in a note, a name or a reaction. Both are drawn here.
import type { Glyph } from '../shared/emoji-find.ts';
import { toned } from '../shared/emoji-find.ts';
import type { Picked } from '../shared/emoji-used.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';

/** One choice of the picker: what it puts in, and what is known about it. */
export type Item = {
  readonly picked: Picked;
  readonly glyph?: Glyph;
  /** A custom emoji's set: its title, or '' for the reader's own list. */
  readonly set?: string;
  /** The source distinguishes same-code search cells for assistive readers. */
  sourceLabel?: string;
};

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The name a reader of this language knows it by. */
export const glyphName = (g: Glyph): string => (getLang() === 'ja' && g.ja ? g.ja : capital(g.en));

/** A custom emoji's picture, held to its box; when it cannot be had, its code in small type. */
export function emojiPicture(code: string, url: string, cls: string): HTMLElement {
  const img = h('img', {
    class: cls,
    src: url,
    alt: code,
    loading: 'lazy',
    decoding: 'async',
    draggable: false,
  });
  img.addEventListener('error', () => img.replaceWith(h('span', { class: `${cls} efail` }, code)));
  return img;
}

/** The large picture and the two lines for one emoji. */
export function describe(item: Item, tone: number): Node[] {
  const { picked, glyph, set } = item;
  if (picked.url)
    return [
      emojiPicture(picked.emoji, picked.url, 'ebig'),
      h(
        'span',
        { class: 'etext' },
        h('span', { class: 'ename' }, picked.emoji),
        h('span', { class: 'ecode' }, set || (set === '' ? t('emoji.mine') : '')),
      ),
    ];
  return [
    h('span', { class: 'ebig' }, glyph ? toned(glyph, tone) : picked.emoji),
    h(
      'span',
      { class: 'etext' },
      h('span', { class: 'ename' }, glyph ? glyphName(glyph) : ''),
      h('span', { class: 'ecode' }, glyph?.code ? `:${glyph.code}:` : ''),
    ),
  ];
}

/** The picker's strip: always the same height; empty when there is nothing to say. */
export function createPreview(): {
  el: HTMLElement;
  show(item: Item | undefined, tone: number): void;
} {
  const el = h('div', { class: 'eprev', 'aria-hidden': 'true' });
  let shown: Item | undefined;
  let shownTone = -1;
  return {
    el,
    show(item, tone) {
      if (item === shown && tone === shownTone) return;
      shown = item;
      shownTone = tone;
      replaceChildren(el, item ? describe(item, tone) : null);
    },
  };
}

/** Calls `held` when a finger rests on `el` (or a descendant matching `match`) without moving; the click that
 * would follow the lift is then swallowed, as is the browser's own long-press menu. */
export function onLongPress(
  el: HTMLElement | Document,
  match: string,
  held: (target: HTMLElement) => void,
  ms = 420,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let from: { x: number; y: number } | undefined;
  let fired = false;
  const stop = (): void => {
    clearTimeout(timer);
    timer = from = undefined;
  };
  el.addEventListener('pointerdown', (ev) => {
    const e = ev as PointerEvent;
    fired = false;
    const target = (e.target as Element | null)?.closest<HTMLElement>(match);
    if (e.pointerType !== 'touch' || !target) return;
    from = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      fired = true;
      held(target);
    }, ms);
  });
  el.addEventListener('pointermove', (ev) => {
    const e = ev as PointerEvent;
    if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > 8) stop();
  });
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener(
    'click',
    (e) => {
      if (!fired) return;
      fired = false;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
  el.addEventListener('contextmenu', (e) => {
    if (fired || timer) e.preventDefault();
  });
}
