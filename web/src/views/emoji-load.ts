// Custom emoji in text: loaded ahead of the reader, and never resized in view. Each one holds a box of the line's
// height from the start, as wide as the same picture was when last seen on this device, or square. Its picture is
// asked for when the row comes within one and a half tile heights of what the tile shows (a browser's own lazy
// loading waits, inside a scrolling tile, until it is in view). When it arrives with another shape, or fails and
// becomes its `:code:`, the new width waits until the emoji is out of sight; meanwhile the picture sits contained in
// its box, or the code is drawn small inside it (whole in its tooltip). Above the reading place the anchor absorbs
// the change; below it nobody sees it.
import { h } from '../shared/h.ts';
import { kv } from '../shared/storage.ts';

const AHEAD = '150% 0px';
/** Widths in `em` of the line: a square, and the widest a picture may take. */
const SQUARE = 1.25;
const WIDEST = 4;
/** A failed emoji held in its box draws its code at this size. */
const SMALL = 0.6;
const SHAPES = 'emoji:shapes';
/** Pictures whose width is kept on the device. */
const KEEP = 256;
const SWEEP_MS = 10_000;
/** A transparent pixel: an image with no picture yet is laid out as its alt text, not as its box. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type Watch = { readonly ahead: IntersectionObserver; readonly view: IntersectionObserver };
/** Bound: one per scrolling view; they go with their view. */
const watches = new WeakMap<Element, Watch>();
/** Emoji being watched (waiting to load, or to take their width), so that one whose row has gone stops being
 * watched and kept. Bound: the emoji of mounted rows. */
const waiting = new Map<Element, Watch>();
/** What an emoji does once it is out of sight. Bound: as `waiting`. */
const later = new Map<Element, () => void>();
/** Bound: the emoji made since the last frame. */
const fresh = new Set<HTMLImageElement>();
let queued = false;
let sweep: ReturnType<typeof setTimeout> | undefined;
let shapes: Map<string, number> | undefined;
let saving: ReturnType<typeof setTimeout> | undefined;

function shapesNow(): Map<string, number> {
  if (shapes) return shapes;
  const v = kv.get(SHAPES);
  shapes = new Map(
    v && typeof v === 'object'
      ? Object.entries(v as Record<string, unknown>).filter(
          (e): e is [string, number] => typeof e[1] === 'number',
        )
      : [],
  );
  return shapes;
}
function remember(url: string, width: number): void {
  const all = shapesNow();
  all.delete(url);
  all.set(url, width);
  for (const key of all.keys()) if (all.size > KEEP) all.delete(key);
  clearTimeout(saving);
  saving = setTimeout(() => kv.set(SHAPES, Object.fromEntries(all)), 2000);
}
const widthOf = (img: HTMLImageElement): number =>
  img.naturalHeight > 0
    ? Math.round(
        Math.min(WIDEST, Math.max(1, (SQUARE * img.naturalWidth) / img.naturalHeight)) * 20,
      ) / 20
    : SQUARE;

function forget(el: Element): void {
  const w = waiting.get(el);
  w?.ahead.unobserve(el);
  w?.view.unobserve(el);
  waiting.delete(el);
  later.delete(el);
}
function release(): void {
  sweep = undefined;
  for (const el of [...waiting.keys()]) if (!el.isConnected) forget(el);
  if (waiting.size) sweep = setTimeout(release, SWEEP_MS);
}
const watchOf = (root: Element): Watch => {
  const known = watches.get(root);
  if (known) return known;
  const ahead = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        ahead.unobserve(e.target);
        waiting.delete(e.target);
        start(e.target as HTMLImageElement);
      }
    },
    { root, rootMargin: AHEAD },
  );
  const view = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const then = later.get(e.target);
        if (e.isIntersecting || !then) continue;
        forget(e.target);
        then();
      }
    },
    { root },
  );
  const made = { ahead, view };
  watches.set(root, made);
  return made;
};
function watch(el: Element, how: (w: Watch) => IntersectionObserver): boolean {
  const root = el.isConnected ? el.closest('.view') : null;
  if (!root || typeof IntersectionObserver === 'undefined') return false;
  const w = watchOf(root);
  waiting.set(el, w);
  how(w).observe(el);
  if (sweep === undefined) sweep = setTimeout(release, SWEEP_MS);
  return true;
}

function start(img: HTMLImageElement): void {
  const src = img.dataset.src;
  if (!src) return;
  delete img.dataset.src;
  img.src = src;
}
/** `apply` at once when `el` is out of sight (or not in a scrolling view), otherwise when it leaves the view. */
function whenOutOfSight(el: Element, apply: () => void): void {
  later.set(el, apply);
  if (!watch(el, (w) => w.view)) later.delete(el), apply();
}
function settle(): void {
  queued = false;
  for (const img of fresh) {
    fresh.delete(img);
    if (!watch(img, (w) => w.ahead)) start(img);
  }
}

/** A custom emoji in text, `focusable` when it stands alone. A picture that cannot be had becomes its code. */
export function inlineEmoji(code: string, url: string, focusable: boolean): HTMLElement {
  const near = /^(data|blob):/.test(url);
  const img = h('img', {
    class: 'emo',
    alt: code,
    tabindex: focusable ? 0 : null,
    draggable: false,
    // A picture already in the page (data:, blob:) costs nothing to show: only pictures from afar wait.
    src: near ? url : BLANK,
    'data-src': near ? null : url,
  });
  img.style.width = `${shapesNow().get(url) ?? SQUARE}em`;
  img.addEventListener('load', () => {
    if (img.dataset.src) return; // the blank pixel
    const width = widthOf(img);
    remember(url, width);
    if (`${width}em` !== img.style.width)
      whenOutOfSight(img, () => {
        img.style.width = `${width}em`;
        img.dispatchEvent(new Event('note-geometry-changed', { bubbles: true }));
      });
  });
  img.addEventListener('error', () => {
    const box = Number.parseFloat(img.style.width) || SQUARE;
    const text = h(
      'span',
      { class: 'emo efail held', title: code, tabindex: focusable ? 0 : null },
      code,
    );
    text.style.width = `${box / SMALL}em`;
    forget(img);
    img.replaceWith(text);
    whenOutOfSight(text, () => {
      text.classList.remove('held');
      text.style.width = '';
      text.dispatchEvent(new Event('note-geometry-changed', { bubbles: true }));
    });
  });
  if (near) return img;
  if (typeof requestAnimationFrame === 'undefined') start(img);
  else {
    fresh.add(img);
    if (!queued) (queued = true), requestAnimationFrame(settle);
  }
  return img;
}

/** The picture's address, loaded or still waiting. */
export const pictureOf = (img: HTMLImageElement): string =>
  img.dataset.src || img.currentSrc || img.src || '';
/** For tests: how many emoji are watched now. */
export const watchedEmoji = (): number => waiting.size;
