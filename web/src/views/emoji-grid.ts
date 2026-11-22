// The picker's grid: sections (frequently used, the custom tab's sub-groups, the Unicode categories, or the matches of
// a search) of equal cells; a section with no cells may hold one line instead. The first screenful is drawn at once
// and the rest in the next frames, so the picker opens without waiting for two thousand buttons. One cell takes Tab;
// the arrows walk the cells row by row.
import { toned } from '../shared/emoji-find.ts';
import { h, replaceChildren } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { emojiPicture, glyphName, type Item, onLongPress } from './emoji-preview.ts';

export type Section = {
  readonly id: string;
  /** Shown above the cells; '' for none (search matches). */
  readonly label: string;
  readonly items: readonly Item[];
  /** The button of the row of categories it lights, when several sections share one (the custom tab). */
  readonly cat?: string;
  /** One line shown, with the heading, when there are no cells. */
  readonly note?: string;
};
/** The category a section belongs to. */
export const catOf = (s: Section): string => s.cat ?? s.id;
type Hooks = {
  readonly choose: (item: Item) => void;
  /** The item to describe: under the pointer, with the keyboard, or held by a finger; undefined: the default. */
  readonly preview: (item: Item | undefined) => void;
  /** The category in view. */
  readonly section: (cat: string) => void;
  /** Up from the first row, or `lost`: the cell with the keyboard was redrawn away. */
  readonly leaveTop: (lost?: boolean) => void;
  readonly tone: () => number;
};
/** Cells drawn at once on opening; the rest follow a section per frame. */
const FIRST = 200;

export function createGrid(hooks: Hooks) {
  const el = h('div', { class: 'egrid' });
  /** Everything drawn; `sections`, the ones with cells, which the keyboard walks. */
  let shown: readonly Section[] = [];
  let sections: readonly Section[] = [];
  let items: Item[] = [];
  let starts: number[] = [];
  let boxes: HTMLElement[] = [];
  let drawn = 0;
  let current = 0;
  let frame = 0;
  let hovered = false;

  const label = (it: Item): string =>
    it.glyph
      ? glyphName(it.glyph) || it.picked.emoji
      : it.sourceLabel
        ? `${it.picked.emoji}, ${it.sourceLabel}`
        : it.picked.emoji;
  const cell = (it: Item, i: number): HTMLElement =>
    h(
      'button',
      {
        class: 'ecell',
        'data-i': i,
        tabindex: i === current ? 0 : -1,
        'aria-label': label(it),
      },
      it.picked.url
        ? emojiPicture(it.picked.emoji, it.picked.url, 'eimg')
        : it.glyph
          ? toned(it.glyph, hooks.tone())
          : it.picked.emoji,
    );
  const fill = (s: number): void => {
    const box = boxes[s];
    const sec = sections[s];
    if (!box || !sec || box.childElementCount) return;
    const at = starts[s] ?? 0;
    box.append(...sec.items.map((it, j) => cell(it, at + j)));
  };
  const drawTo = (s: number): void => {
    while (drawn <= s && drawn < sections.length) fill(drawn++);
  };
  const more = (): void => {
    frame = 0;
    if (drawn >= sections.length) return;
    drawTo(drawn);
    frame = requestAnimationFrame(more);
  };

  /** `keep`: the same things arrived again or more of them (the reader's sets, the table): stay where the reader is. */
  function draw(next: readonly Section[], keep = false): void {
    const groups = [...el.querySelectorAll<HTMLElement>('.egroup')];
    // A reader who has not scrolled stays at the top, where what arrived (their own emoji) is drawn first.
    const top =
      keep && el.scrollTop > 0
        ? groups.filter((g) => g.offsetTop <= el.scrollTop).pop()
        : undefined;
    const place = top
      ? {
          id: top.dataset.section ?? '',
          cat: top.dataset.cat ?? '',
          by: el.scrollTop - top.offsetTop,
        }
      : undefined;
    const focused = el.contains(document.activeElement);
    cancelAnimationFrame(frame);
    shown = next.filter((s) => s.items.length || s.note);
    sections = shown.filter((s) => s.items.length);
    items = sections.flatMap((s) => s.items);
    starts = [];
    let n = 0;
    for (const s of sections) starts.push(n), (n += s.items.length);
    current = 0;
    drawn = 0;
    boxes = sections.map(() => h('div', { class: 'ecells' }));
    replaceChildren(
      el,
      sections.length
        ? shown.map((s) =>
            h(
              'div',
              {
                class: 'egroup',
                role: 'group',
                'data-section': s.id,
                'data-cat': catOf(s),
                'aria-label': s.label || null,
              },
              s.label ? h('div', { class: 'ehd' }, s.label) : null,
              s.items.length ? boxes[sections.indexOf(s)] : h('p', { class: 'enote' }, s.note),
            ),
          )
        : h('div', { class: 'muted enone' }, t('emoji.none')),
    );
    el.scrollTop = 0;
    let cells = 0;
    while (drawn < sections.length && cells < FIRST)
      (cells += sections[drawn]?.items.length ?? 0), drawTo(drawn);
    frame = requestAnimationFrame(more);
    hooks.section(shown[0] ? catOf(shown[0]) : '');
    if (place && shown.some((x) => x.id === place.id)) {
      jump(place.id);
      el.scrollTop += place.by;
      // Its section was replaced (the custom tab's line by the sets that arrived): the reader stays in its category.
    } else if (place && shown.some((x) => catOf(x) === place.cat)) jump(place.cat);
    // The cell that had the keyboard is gone: the keyboard goes back to the field, not to the page.
    if (focused) hooks.leaveTop(true);
  }
  /** To a section by its id, or to the first of a category. */
  function jump(id: string): void {
    const at = shown.findIndex((x) => x.id === id);
    const to = shown[at < 0 ? shown.findIndex((x) => catOf(x) === id) : at];
    if (!to) return;
    // Everything above it is drawn, so it is where it will stay.
    const above = shown.slice(0, shown.indexOf(to) + 1);
    drawTo(sections.findLastIndex((x) => above.includes(x)));
    const g = el.querySelector<HTMLElement>(`.egroup[data-section="${CSS.escape(to.id)}"]`);
    if (g) el.scrollTop = g.offsetTop;
    hooks.section(catOf(to));
  }

  const sectionOf = (i: number): number => {
    let s = 0;
    while (s + 1 < starts.length && (starts[s + 1] ?? 0) <= i) s++;
    return s;
  };
  const cellAt = (i: number): HTMLElement | null => {
    drawTo(sectionOf(i));
    return el.querySelector<HTMLElement>(`.ecell[data-i="${i}"]`);
  };
  const itemOf = (node: EventTarget | null): Item | undefined => {
    const c = (node as Element | null)?.closest?.<HTMLElement>('.ecell');
    return c ? items[Number(c.dataset.i)] : undefined;
  };
  const columns = (): number =>
    Math.max(1, getComputedStyle(boxes[0] ?? el).gridTemplateColumns.split(' ').length);

  /** Where an arrow key goes from cell i; -1: out of the top. */
  function step(i: number, key: string): number {
    const cols = columns();
    const s = sectionOf(i);
    const at = starts[s] ?? 0;
    const len = sections[s]?.items.length ?? 0;
    const o = i - at;
    const col = o % cols;
    if (key === 'ArrowLeft') return Math.max(0, i - 1);
    if (key === 'ArrowRight') return Math.min(items.length - 1, i + 1);
    if (key === 'Home') return 0;
    if (key === 'End') return items.length - 1;
    if (key === 'ArrowDown') {
      if (o + cols < len) return i + cols;
      if (Math.floor(o / cols) < Math.floor((len - 1) / cols)) return at + len - 1;
      const next = starts[s + 1];
      if (next === undefined) return i;
      return next + Math.min(col, (sections[s + 1]?.items.length ?? 1) - 1);
    }
    if (key === 'ArrowUp') {
      if (o >= cols) return i - cols;
      const prev = sections[s - 1];
      if (!prev) return -1;
      const pAt = starts[s - 1] ?? 0;
      const lastRow = Math.floor((prev.items.length - 1) / cols) * cols;
      return Math.min(pAt + lastRow + col, pAt + prev.items.length - 1);
    }
    return i;
  }
  function focusAt(i: number): void {
    const c = cellAt(i);
    if (!c) return;
    el.querySelector('.ecell[tabindex="0"]')?.setAttribute('tabindex', '-1');
    c.tabIndex = 0;
    current = i;
    c.focus();
  }

  el.addEventListener('click', (e) => {
    const it = itemOf(e.target);
    if (it) hooks.choose(it);
  });
  el.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const it = itemOf(e.target);
    if (it) (hovered = true), hooks.preview(it);
  });
  el.addEventListener('pointerleave', () => {
    if (!hovered) return;
    hovered = false;
    hooks.preview(el.contains(document.activeElement) ? itemOf(document.activeElement) : undefined);
  });
  el.addEventListener('focusin', (e) => {
    const c = (e.target as Element).closest<HTMLElement>('.ecell');
    if (!c) return;
    current = Number(c.dataset.i);
    hooks.preview(items[current]);
  });
  el.addEventListener('focusout', (e) => {
    if (!el.contains(e.relatedTarget as Node | null) && !hovered) hooks.preview(undefined);
  });
  el.addEventListener('keydown', (e) => {
    if (!(e.target as Element).closest('.ecell')) return;
    if (!/^(Arrow|Home$|End$)/.test(e.key)) return;
    e.preventDefault();
    const to = step(current, e.key);
    if (to < 0) hooks.leaveTop();
    else focusAt(to);
  });
  onLongPress(el, '.ecell', (c) => {
    const it = itemOf(c);
    if (it) hooks.preview(it);
  });
  el.addEventListener(
    'scroll',
    () => {
      const top = el.scrollTop + 4;
      let cat = shown[0] ? catOf(shown[0]) : '';
      for (const g of el.querySelectorAll<HTMLElement>('.egroup'))
        if (g.offsetTop <= top) cat = g.dataset.cat ?? cat;
      hooks.section(cat);
    },
    { passive: true },
  );

  return {
    el,
    draw,
    /** The cell Enter takes from the search field. */
    first: (): Item | undefined => items[0],
    focusFirst: (): void => focusAt(0),
    jump,
    /** Redraws the skin-toned cells in the reader's tone. */
    retone(): void {
      const tone = hooks.tone();
      for (const c of el.querySelectorAll<HTMLElement>('.ecell')) {
        const g = items[Number(c.dataset.i)]?.glyph;
        if (g?.skins) c.textContent = toned(g, tone);
      }
    },
    stop: (): void => cancelAnimationFrame(frame),
  };
}
