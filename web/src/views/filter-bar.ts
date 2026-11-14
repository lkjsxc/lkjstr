// The filter of a feed: part of the tab and saved with it. A bar of ▶ and a text field (as in ytenrich's lists);
// ▶ opens the rest: replies, reposts, media, period. The bar is out of the way until it is asked for (the tile's
// menu, or "/"), and stays in view for as long as it narrows anything.
import type { Query } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';

export type Filter = {
  text?: string;
  replies?: boolean;
  reposts?: boolean;
  media?: 'only' | 'none';
  range?: 'day' | 'week';
  open?: boolean;
  /** The reader asked for the bar. */
  shown?: boolean;
};

/** The query fields a filter stands for. Pure, tested. */
export function filterQuery(f: Filter, now: number): Partial<Query> {
  const out: { -readonly [K in keyof Query]?: Query[K] } = {};
  if (f.text?.trim()) out.text = f.text.trim();
  if (f.replies === false) out.replies = false;
  if (f.reposts === false) out.reposts = false;
  if (f.media) out.media = f.media;
  if (f.range) out.since = now - (f.range === 'day' ? 1 : 7) * 86_400_000;
  return out;
}
export const filterActive = (f: Filter): boolean =>
  f.replies === false || f.reposts === false || Boolean(f.media) || Boolean(f.range);
/** Whether the feed is narrowed at all: then the bar is in view whether it was asked for or not. */
export const filterNarrows = (f: Filter): boolean => filterActive(f) || Boolean(f.text?.trim());

export function filterBar(
  f: Filter,
  placeholder: Key,
  change: (next: Filter, typing: boolean) => void,
  /** Escape in an empty field. */
  leave: () => void,
): HTMLElement {
  const seg = <T>(
    label: Key,
    options: readonly (readonly [T, Key])[],
    value: T,
    set: (v: T) => Filter,
  ): HTMLElement =>
    h(
      'div',
      { class: 'prow' },
      h('span', { class: 'muted' }, t(label)),
      h(
        'div',
        { class: 'seg-ctl' },
        options.map(([v, key]) =>
          h(
            'button',
            {
              class: v === value ? 'chip on' : 'chip',
              'aria-pressed': v === value,
              onclick: () => change(set(v), false),
            },
            t(key),
          ),
        ),
      ),
    );
  const panel = h(
    'div',
    { class: 'rpanel', hidden: !f.open },
    seg(
      'filter.replies',
      [
        [true, 'filter.show'],
        [false, 'filter.hide'],
      ] as const,
      f.replies !== false,
      (v) => ({ ...f, replies: v }),
    ),
    seg(
      'filter.reposts',
      [
        [true, 'filter.show'],
        [false, 'filter.hide'],
      ] as const,
      f.reposts !== false,
      (v) => ({ ...f, reposts: v }),
    ),
    seg(
      'filter.media',
      [
        [undefined, 'filter.any'],
        ['only', 'filter.mediaOnly'],
        ['none', 'filter.mediaNone'],
      ] as const,
      f.media,
      (v) => ({ ...f, media: v }),
    ),
    seg(
      'filter.range',
      [
        [undefined, 'filter.any'],
        ['day', 'filter.day'],
        ['week', 'filter.week'],
      ] as const,
      f.range,
      (v) => ({ ...f, range: v }),
    ),
  );
  const toggle = h(
    'button',
    {
      class: `rtoggle${f.open ? ' on' : ''}${filterActive(f) ? ' set' : ''}`,
      title: t('filter.title'),
      'aria-label': t('filter.title'),
      'aria-expanded': f.open === true,
      onclick: () => change({ ...f, open: !f.open }, false),
    },
    f.open ? '▼' : '▶',
  );
  const input = h('input', {
    type: 'search',
    value: f.text ?? '',
    placeholder: t(placeholder),
    'aria-label': t(placeholder),
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => change({ ...f, text: input.value }, true), 250);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !input.value) e.preventDefault(), leave();
  });
  return h('div', { class: 'fbar' }, h('div', { class: 'rbar' }, toggle, input), panel);
}
