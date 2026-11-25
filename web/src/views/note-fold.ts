import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { writeNoteState } from '../shared/note-state.ts';
import { stableNoteWidths } from './note-fit-geometry.ts';

type Fold = {
  readonly lines?: number;
  readonly tail: readonly HTMLElement[];
};

const bodyOf = (el: HTMLElement): HTMLElement | null =>
  el.querySelector<HTMLElement>('.content[data-fold]:not([data-unfolded])');
const moreOf = (body: HTMLElement): HTMLButtonElement | null =>
  body.querySelector<HTMLButtonElement>(':scope > .fold');

/** Read the natural body, with reserved media sizes and complete blocks after the text. */
function measure(body: HTMLElement): Fold | undefined {
  const style = getComputedStyle(body);
  const lines = Math.round(Number.parseFloat(style.getPropertyValue('--fold') || '12'));
  if (!lines) return;
  const first = body.firstElementChild;
  const text = first instanceof HTMLElement && first.matches('.text') ? first : undefined;
  const line = Number.parseFloat(text ? getComputedStyle(text).lineHeight : style.lineHeight);
  const budget = lines * line;
  const bounds = body.getBoundingClientRect();
  if (!(bounds.width > 0 && bounds.height >= budget + 2 * line - 0.5)) return;
  const blocks = [...body.children].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !el.classList.contains('fold'),
  );
  const media = blocks.find((block) => block.classList.contains('media'));
  if (text) {
    const textBounds = text.getBoundingClientRect();
    const mediaRoom = media ? media.getBoundingClientRect().bottom - textBounds.bottom : 0;
    const textLines = Math.max(1, Math.floor((budget - mediaRoom + 0.5) / line));
    const textRoom = textLines * line;
    if (
      textBounds.height > textRoom + 0.5 &&
      bounds.height - textRoom - mediaRoom >= 2 * line - 0.5
    )
      return { lines: textLines, tail: blocks.slice(1).filter((block) => block !== media) };
  }

  // Keep the note's media grid whole, including when the media alone exceeds the budget.
  const keepThrough = media ? blocks.indexOf(media) : 0;
  const cut = blocks.findIndex(
    (block, i) =>
      i > keepThrough && block.getBoundingClientRect().bottom > bounds.top + budget + 0.5,
  );
  const last = blocks[cut - 1];
  if (!last || bounds.bottom - last.getBoundingClientRect().bottom < 2 * line - 0.5) return;
  return { tail: blocks.slice(cut) };
}

function apply(body: HTMLElement, fit: Fold | undefined): void {
  const more = moreOf(body);
  for (const block of body.querySelectorAll(':scope > .fold-tail'))
    block.classList.remove('fold-tail');
  body.style.removeProperty('--shown-lines');
  if (!fit) {
    more?.remove();
    return;
  }
  if (fit.lines) body.style.setProperty('--shown-lines', String(fit.lines));
  for (const block of fit.tail) block.classList.add('fold-tail');
  body.classList.add('folded');
  if (more) return;
  const button = h('button', { class: 'lnk fold' }, t('note.more'));
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const { instance, note } = body.closest<HTMLElement>('[data-note]')?.dataset ?? {};
    if (instance && note) writeNoteState(instance, note, { unfolded: true });
    body.dataset.unfolded = '';
    body.querySelector(':scope > .text')?.classList.add('open');
    body.classList.remove('folded');
    apply(body, undefined);
    body.dispatchEvent(new Event('note-content-changed', { bubbles: true }));
  });
  body.append(button);
}

/** Read each batch before changing its height, where a scrollbar cannot change the line width. */
export function fitNotes(elements: readonly HTMLElement[]): void {
  if (!elements.length) return;
  const fitBatch = (batch: readonly HTMLElement[]): void => {
    const bodies = batch.map(bodyOf).filter((body) => body !== null);
    const focus = document.activeElement;
    for (const body of bodies) body.classList.remove('folded');
    const fits = bodies.map(measure);
    bodies.forEach((body, i) => apply(body, fits[i]));
    if (focus instanceof HTMLButtonElement && focus.classList.contains('fold') && focus.isConnected)
      focus.focus({ preventScroll: true });
  };
  if (stableNoteWidths(elements)) fitBatch(elements);
  else for (const el of elements) fitBatch([el]);
}

export const fitNote = (el: HTMLElement): void => fitNotes([el]);

/** One width observer for the row list, with font and emoji changes coalesced into the same pass. */
export function createNoteFits(list: HTMLElement) {
  let width: number | undefined;
  let frame = 0;
  let all = false;
  const dirty = new Set<HTMLElement>(); // bound: rows changed before the next animation frame
  const run = (): void => {
    frame = 0;
    const changed = all
      ? [...list.children].filter((el): el is HTMLElement => el instanceof HTMLElement)
      : [...dirty].filter((el) => el.parentElement === list);
    all = false;
    dirty.clear();
    if (!list.clientWidth) return;
    fitNotes(changed);
    list.dispatchEvent(new Event('note-content-changed', { bubbles: true }));
  };
  const queue = (): void => {
    if (!frame) frame = requestAnimationFrame(run);
  };
  const refit = (): void => {
    all = true;
    queue();
  };
  const sizes = new ResizeObserver(([entry]) => {
    if (!entry || width === entry.contentRect.width) return;
    width = entry.contentRect.width;
    if (width > 0 && list.firstChild) refit();
  });
  sizes.observe(list);
  const changed = (e: Event): void => {
    const row = (e.target as Element).closest<HTMLElement>('.note');
    if (row?.parentElement === list) {
      dirty.add(row);
      queue();
    }
  };
  list.addEventListener('note-geometry-changed', changed);
  document.fonts?.addEventListener('loadingdone', refit);
  return {
    fit(elements: readonly HTMLElement[]) {
      if (!elements.length) return;
      // A complete draw already measures every row at the current scrollbar width.
      if (width === undefined || elements.length === list.childElementCount)
        width = list.getBoundingClientRect().width;
      fitNotes(elements);
    },
    dispose() {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      document.fonts?.removeEventListener('loadingdone', refit);
      list.removeEventListener('note-geometry-changed', changed);
    },
  };
}
