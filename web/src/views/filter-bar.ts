// Saved feed filters. Active fields retain their literal text and native selection.
import type { Query } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { pressed } from '../shared/keys.ts';

export type Filter = {
  /** The query as typed. */
  text?: string;
  replies?: boolean;
  reposts?: boolean;
  media?: 'only' | 'none';
  /** The period: local days as `yyyy-mm-dd`, both included. */
  start?: string;
  end?: string;
  /** Only these people, each as typed (a name, an npub, a NIP-05 name). */
  people?: string[];
  /** Notifications flow into the timeline. */
  news?: boolean;
  open?: boolean;
  /** The reader asked for the row while the setting hides it. */
  shown?: boolean;
};
export type FilterOpts = {
  /** The engine understands the whole query, the people and the notifications (protocol 3). */
  readonly rich: boolean;
  /** A timeline of the reader's own account: notifications can flow into it. */
  readonly news: boolean;
};
type Has = 'image' | 'video' | 'link';
export type Parsed = {
  words: string[];
  phrases: string[];
  exclude: string[];
  from: string[];
  has: Has[];
};

/** A typed query in its parts. Pure, tested. */
export function parseQuery(text: string): Parsed {
  const out: Parsed = { words: [], phrases: [], exclude: [], from: [], has: [] };
  for (const m of text.matchAll(/(-?)(from:|has:)?(?:"([^"]*)"|(\S+))/gi)) {
    const value = (m[3] ?? m[4] ?? '').trim();
    const op = (m[2] ?? '').toLowerCase();
    if (!value) continue;
    if (m[1]) out.exclude.push(`${op}${value}`);
    else if (op === 'from:') out.from.push(value.replace(/^@/, ''));
    else if (op === 'has:' && /^(image|video|link)$/i.test(value))
      out.has.push(value.toLowerCase() as Has);
    else if (op) out.words.push(`${op}${value}`);
    else if (m[3] !== undefined) out.phrases.push(value);
    else out.words.push(value);
  }
  return out;
}
/** The first instant of a local day `yyyy-mm-dd` (undefined: not a day of the calendar). */
const dayStart = (day: string | undefined): number | undefined => {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(day ?? '');
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3])
    ? d.getTime()
    : undefined;
};

/** The query fields a filter stands for. Pure, tested. */
export function filterQuery(f: Filter, rich = true): Partial<Query> {
  const out: { -readonly [K in keyof Query]?: Query[K] } = {};
  const raw = f.text?.trim() ?? '';
  const p = parseQuery(rich ? raw : '');
  if (!rich && raw) out.text = raw;
  if (p.words.length) out.text = p.words.join(' ');
  if (p.phrases.length) out.phrases = p.phrases;
  if (p.exclude.length) out.exclude = p.exclude;
  if (p.has.length) out.has = [...new Set(p.has)];
  const from = [...p.from, ...(rich ? (f.people ?? []) : [])];
  if (from.length) out.from = [...new Set(from)];
  if (f.replies === false) out.replies = false;
  if (f.reposts === false) out.reposts = false;
  if (f.media) out.media = f.media;
  const since = dayStart(f.start);
  const until = dayStart(f.end);
  if (since !== undefined) out.since = since;
  if (until !== undefined) {
    const next = new Date(until);
    next.setDate(next.getDate() + 1);
    out.until = next.getTime() - 1;
  }
  if (rich && f.news) out.notifications = true;
  return out;
}
export const filterActive = (f: Filter): boolean =>
  f.replies === false ||
  f.reposts === false ||
  Boolean(f.media || f.start || f.end || f.news || f.people?.length);
/** Whether the feed is changed at all: then the row is in view whether it was asked for or not. */
export const filterNarrows = (f: Filter): boolean => filterActive(f) || Boolean(f.text?.trim());

export function filterBar(
  f: Filter,
  placeholder: Key,
  onChange: (next: Filter, typing: boolean) => void,
  /** Escape in an empty field. */
  leave: () => void,
  /** Takes every narrowing back: offered in the row while there is one. */
  clear: (() => void) | undefined,
  opts: FilterOpts,
): HTMLElement & { dispose(): void } {
  const change = (next: Filter, typed: boolean): void => {
    f = next;
    drawPeople();
    if (reset) reset.hidden = !filterNarrows(next);
    onChange(next, typed);
  };
  const line = (label: Key, ...body: (HTMLElement | null)[]): HTMLElement =>
    h('div', { class: 'prow' }, h('span', { class: 'muted' }, t(label)), ...body);
  const seg = <T>(
    label: Key,
    options: readonly (readonly [T, Key])[],
    value: T,
    set: (v: T) => Filter,
  ): HTMLElement =>
    line(
      label,
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
  const onOff = [
    [true, 'filter.show'],
    [false, 'filter.hide'],
  ] as const;
  // Days are typed and shown as yyyy/mm/dd, as every date here is; a day that is not one is marked and ignored.
  const day = (key: 'start' | 'end', label: Key): HTMLElement => {
    const field = h('input', {
      type: 'text',
      inputmode: 'numeric',
      size: 10,
      value: (f[key] ?? '').replaceAll('-', '/'),
      placeholder: 'yyyy/mm/dd',
      'aria-label': t(label),
      title: t(label),
    });
    const apply = (): void => {
      if (reset && field.value) reset.hidden = false;
      const m = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(field.value.trim());
      const next = m ? `${m[1]}-${m[2]?.padStart(2, '0')}-${m[3]?.padStart(2, '0')}` : undefined;
      const invalid = !!field.value.trim() && dayStart(next) === undefined;
      if (invalid) return field.setAttribute('aria-invalid', 'true');
      field.removeAttribute('aria-invalid');
      if (f[key] !== next) change({ ...f, [key]: next }, true);
    };
    field.addEventListener('input', (e) => {
      if (!(e as InputEvent).isComposing) apply();
    });
    field.addEventListener('blur', apply);
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        apply();
      }
    });
    return field;
  };
  const person = h('input', {
    type: 'text',
    class: 'padd',
    placeholder: t('filter.person'),
    'aria-label': t('filter.person'),
    onkeydown: (e) => {
      const ev = e as KeyboardEvent;
      const name = person.value.trim().replace(/^@/, '');
      if (ev.key !== 'Enter' || ev.isComposing || ev.keyCode === 229 || !name) return;
      ev.preventDefault();
      person.value = '';
      change({ ...f, people: [...new Set([...(f.people ?? []), name])] }, false);
    },
  });
  person.addEventListener('input', () => {
    if (reset && person.value) reset.hidden = false;
  });
  person.addEventListener('blur', () => {
    const name = person.value.trim().replace(/^@/, '');
    if (!name) return;
    person.value = '';
    change({ ...f, people: [...new Set([...(f.people ?? []), name])] }, false);
  });
  const personChips = h('span', { class: 'person-chips' });
  const drawPeople = (): void => {
    personChips.replaceChildren(
      ...(f.people ?? []).map((name) =>
        h(
          'button',
          {
            class: 'chip on',
            title: t('list.remove', { what: name }),
            onclick: () =>
              change({ ...f, people: (f.people ?? []).filter((x) => x !== name) }, false),
          },
          `${name} ×`,
        ),
      ),
    );
  };
  drawPeople();
  const panel = h(
    'div',
    { class: 'rpanel', hidden: !f.open },
    seg('filter.replies', onOff, f.replies !== false, (v) => ({ ...f, replies: v })),
    seg('filter.reposts', onOff, f.reposts !== false, (v) => ({ ...f, reposts: v })),
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
    line(
      'filter.range',
      h(
        'div',
        { class: 'pdays' },
        day('start', 'filter.start'),
        h('span', { class: 'muted', 'aria-hidden': 'true' }, '–'),
        day('end', 'filter.end'),
      ),
    ),
    opts.rich ? line('filter.people', h('div', { class: 'ppeople' }, personChips, person)) : null,
    opts.rich && opts.news
      ? seg('filter.news', onOff, f.news === true, (v) => ({ ...f, news: v || undefined }))
      : null,
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
    // The field says what can be typed in it; an engine that takes words only is promised words only.
    placeholder: t(placeholder === 'filter.query' && !opts.rich ? 'filter.words' : placeholder),
    'aria-label': t(placeholder === 'filter.query' ? 'filter.title' : placeholder),
    title: opts.rich ? t('filter.syntax') : null,
  });
  const reset = clear
    ? h(
        'button',
        { class: 'lnk rclear', hidden: !filterNarrows(f), onclick: clear },
        t('filter.clear'),
      )
    : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    if (reset) reset.hidden = !filterNarrows({ ...f, text: input.value });
    clearTimeout(timer);
    timer = setTimeout(() => change({ ...f, text: input.value }, true), 250);
  });
  input.addEventListener('blur', () => {
    clearTimeout(timer);
    change({ ...f, text: input.value }, true);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      clearTimeout(timer);
      change({ ...f, text: input.value }, true);
    }
    if (pressed(e, 'filterLeave') && !input.value) e.preventDefault(), leave();
  });
  const bar = h('div', { class: 'fbar' }, h('div', { class: 'rbar' }, toggle, input, reset), panel);
  return Object.assign(bar, { dispose: () => clearTimeout(timer) });
}
