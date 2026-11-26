import { type Child, h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { writeNoteState } from '../shared/note-state.ts';
import type { SettingsStore } from '../shared/settings.ts';
import { stableNoteWidths } from './note-fit-geometry.ts';

type Fold = {
  readonly height: number;
  readonly hiddenControls: ReadonlySet<HTMLElement>;
};

export function createNoteBody(
  allowFold: boolean,
  unfolded: boolean,
  children: readonly Child[],
  data = false,
): HTMLElement {
  const body = h(
    'div',
    { class: 'content', 'data-fold': allowFold, 'data-unfolded': unfolded, 'data-fold-data': data },
    children,
  );
  return allowFold ? h('div', { class: 'fold-wrap' }, body) : body;
}

const bodyOf = (el: HTMLElement): HTMLElement | null =>
  el.querySelector<HTMLElement>('.content[data-fold]:not([data-unfolded])');
const moreOf = (body: HTMLElement): HTMLButtonElement | null =>
  body.parentElement?.querySelector<HTMLButtonElement>(':scope > .fold') ?? null;

/** The body keeps its natural scroll height when clipped, including the reserved media boxes. */
function measure(body: HTMLElement): Fold | undefined {
  const style = getComputedStyle(body);
  const limit = Math.round(Number.parseFloat(style.getPropertyValue('--fold') || '12'));
  if (!limit) return;
  const data = body.hasAttribute('data-fold-data') ? body.firstElementChild : null;
  const line = data ? getComputedStyle(data).lineHeight : style.lineHeight;
  const height = (data ? 3 : limit) * Number.parseFloat(line);
  const bounds = body.getBoundingClientRect();
  const naturalHeight = body.classList.contains('folded') ? body.scrollHeight : bounds.height;
  if (!(bounds.width > 0 && Math.round(naturalHeight) > Math.round(height))) return;
  const bottom = bounds.top + height;
  const hiddenControls = new Set<HTMLElement>();
  for (const control of body.querySelectorAll<HTMLElement>(
    'a, button, [tabindex], audio[controls], video[controls]',
  )) {
    if (control.getBoundingClientRect().top >= bottom - 0.5) hiddenControls.add(control);
  }
  return { height, hiddenControls };
}

function apply(body: HTMLElement, fit: Fold | undefined): void {
  const more = moreOf(body);
  for (const control of body.querySelectorAll<HTMLElement>('[inert]'))
    if (!fit?.hiddenControls.has(control)) control.inert = false;
  for (const control of fit?.hiddenControls ?? []) if (!control.inert) control.inert = true;
  body.classList.toggle('folded', fit !== undefined);
  if (!fit) {
    body.style.removeProperty('--fold-height');
    if (more && document.activeElement === more) {
      body.tabIndex = -1;
      body.focus({ preventScroll: true });
    }
    more?.remove();
    return;
  }
  body.style.setProperty('--fold-height', `${fit.height}px`);
  if (more) return;
  const button = h('button', { class: 'lnk fold' }, t('note.more'));
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    const { instance, note } = body.closest<HTMLElement>('[data-note]')?.dataset ?? {};
    if (instance && note) writeNoteState(instance, note, { unfolded: true });
    body.dataset.unfolded = '';
    body.querySelector(':scope > .text')?.classList.add('open');
    apply(body, undefined);
    body.dispatchEvent(new Event('note-content-changed', { bubbles: true }));
  });
  body.after(button);
}

/** Read each batch before changing its height, where a scrollbar cannot change the line width. */
export function fitNotes(elements: readonly HTMLElement[]): void {
  if (!elements.length) return;
  const fitBatch = (batch: readonly HTMLElement[]): void => {
    const bodies = batch.map(bodyOf).filter((body) => body !== null);
    const fits = bodies.map(measure);
    bodies.forEach((body, i) => apply(body, fits[i]));
  };
  if (stableNoteWidths(elements)) fitBatch(elements);
  else for (const el of elements) fitBatch([el]);
}

export const fitNote = (el: HTMLElement): void => fitNotes([el]);

/** One width observer for the row list, with font and emoji changes coalesced into the same pass. */
export function createNoteFits(list: HTMLElement, settings: SettingsStore) {
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
  let reading = settings.get();
  const unwatchSettings = settings.subscribe((next) => {
    if (
      reading.foldLines !== next.foldLines ||
      reading.textSize !== next.textSize ||
      reading.mediaHeight !== next.mediaHeight
    )
      refit();
    reading = next;
  });
  const sizes = new ResizeObserver(([entry]) => {
    if (!entry || width === entry.contentRect.width) return;
    width = entry.contentRect.width;
    if (width > 0 && list.firstChild) refit();
  });
  sizes.observe(list);
  const changed = (e: Event): void => {
    const row = (e.target as Element).closest<HTMLElement>('.note');
    if (row?.parentElement === list && bodyOf(row)) {
      dirty.add(row);
      queue();
    }
  };
  list.addEventListener('note-geometry-changed', changed);
  list.addEventListener('note-content-changed', changed);
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
      unwatchSettings();
      document.fonts?.removeEventListener('loadingdone', refit);
      list.removeEventListener('note-geometry-changed', changed);
      list.removeEventListener('note-content-changed', changed);
    },
  };
}
