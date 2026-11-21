// A moment tab (docs/interface-moment.md C4): Their Home around one time. It asks only windows anchored at that
// time, grows each side as the reader nears it, draws a moment line where the time falls, says per end what this
// device holds, and seats the moment a third down the tile once.
import type { Anchor, Author, FromEngine, Row } from '../engine/protocol.ts';
import { clockOf, dayOf, fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import type { RowList } from './feed-draw.ts';
import type { Keeper } from './feed-place.ts';
import { rowTime } from './feed-scrub.ts';
import { faceButton } from './parts.ts';
import type { ViewEnv } from './registry.ts';

type TimeWindow = Extract<FromEngine, { t: 'timeWindow' }>;
const STEP = 60; // rows asked on each side at first and per growth, as a rail seek asks
const LIMIT = 800; // rows a window may hold, both sides together
const NEAR_PX = 1400; // a side grows when the reader comes this close to its end

/** A row the moment tab draws itself: the moment line (`moment:`) or what one end says (`moment:newer|older`). */
export type MomentPart = {
  readonly kind: 'moment-part';
  readonly key: string;
  readonly at: number;
  readonly author?: Author;
  /** The follow list's own time; null while it is not known. */
  readonly follows?: number | null;
  readonly device?: boolean;
  readonly end?:
    | 'newer'
    | 'older'
    | 'newerDevice'
    | 'olderDevice'
    | 'bound'
    | 'unsupported'
    | 'loading'
    | 'stalled'
    | 'none';
};
export type MomentState = { at?: number; sides?: readonly [number, number] };

const stamp = (at: number): string => `${dayOf(at)} ${clockOf(at)}`;
const ENDS: Record<NonNullable<MomentPart['end']>, Key> = {
  newer: 'moment.newerEnd',
  older: 'moment.olderEnd',
  bound: 'moment.bound',
  unsupported: 'home.unsupported',
  loading: 'feed.loading',
  stalled: 'moment.stalled',
  none: 'moment.olderNone',
  newerDevice: 'moment.newerDevice',
  olderDevice: 'moment.olderDevice',
};

/** The moment line, or the quiet line at one end. Never an anchor and passed over by the keyboard. */
export function renderMoment(p: MomentPart, env: ViewEnv): HTMLElement {
  if (p.end) return h('div', { class: 'mend', 'data-pass': '' }, t(ENDS[p.end]));
  const said = [
    p.follows ? t('moment.follows', { time: stamp(p.follows) }) : t('moment.followsUnknown'),
    p.device ? t('moment.deviceOnly') : '',
  ].filter(Boolean);
  const short = p.follows ? t('moment.follows', { time: dayOf(p.follows) }) : '';
  return h(
    'div',
    {
      class: 'moment',
      role: 'separator',
      'data-pass': '',
      'aria-label': [stamp(p.at), ...said].join(', '),
    },
    h(
      'span',
      { class: 'mwhen' },
      p.author ? faceButton(p.author, env, 'av mface') : null,
      h('span', { class: 'mtime', title: fullTime(p.at) }, stamp(p.at)),
    ),
    h('span', { class: 'mdot' }, t('list.dot')),
    h(
      'span',
      { class: 'msaid', title: p.follows ? fullTime(p.follows) : '' },
      h('span', { class: 'mlong' }, said.join(t('list.dot'))),
      short ? h('span', { class: 'mshort' }, [short, ...said.slice(1)].join(t('list.dot'))) : null,
    ),
  );
}

/** The moment of a their-home tab opened on a time; undefined for any other tab. */
export function momentOf(
  kind: string,
  o: {
    readonly el: HTMLElement;
    readonly state: MomentState & { pos?: unknown };
    readonly save: () => void;
    readonly keeper: Keeper;
    readonly drawn: RowList;
    readonly request: (anchor: Anchor, before: number, after: number) => void;
    readonly sync: () => void;
  },
) {
  if (kind !== 'their-home' || !o.state.at) return undefined;
  o.el.classList.add('moment-tab'); // no filter row: a moment is one time, not a list to narrow
  const at = o.state.at;
  let author: Author | undefined;
  let sides: [number, number] = [...(o.state.sides ?? [STEP, STEP])];
  let answer: TimeWindow | undefined;
  let answered: readonly [number, number] | undefined; // the sides the last answer was for
  let asked = false;
  let seated = Boolean(o.state.pos); // a saved place wins over the seat
  const counts = (rows: readonly Row[]): [number, number] => {
    let newer = 0;
    let older = 0;
    for (const r of rows) if (r.kind === 'note' && !r.hidden) rowTime(r) > at ? newer++ : older++;
    return [newer, older];
  };
  /** What one end says, from that side alone: relays still asked, stalled or done (the older side reads relays),
   * or, for a side this device alone answers, whether its rows ran out before the window did. */
  const end = (side: 0 | 1, rows: readonly Row[]): MomentPart['end'] => {
    if (!answer || !answered || answer.followList?.state === 'unknown') return undefined;
    const edge = side ? answer.older : answer.newer;
    if (edge === 'unsupported') return side ? undefined : 'unsupported';
    if (edge === 'loading' || edge === 'stalled') return edge;
    if (sides[side] >= LIMIT) return 'bound';
    const short = counts(rows)[side] < answered[side];
    if (edge === 'end') return short ? 'none' : undefined;
    if (edge !== 'cache-only') return undefined;
    if (short) return side ? 'older' : 'newer';
    // A side this device alone answers, beside a side that reads relays, says so at its own end.
    const other = side ? answer.newer : answer.older;
    return other === 'cache-only' || other === 'unsupported'
      ? undefined
      : side
        ? 'olderDevice'
        : 'newerDevice';
  };
  /** Whether the far end of a side is more than two screens away, so trimming it moves nothing in view. */
  const far = (side: 0 | 1): boolean => {
    const box = o.el.getBoundingClientRect();
    const kids = o.el.querySelector('.list')?.children;
    const edge = side ? kids?.[kids.length - 1] : kids?.[0];
    const r = edge?.getBoundingClientRect();
    return !r || (side ? r.top - box.bottom : box.top - r.bottom) > 2 * o.el.clientHeight;
  };
  /** Once per tab, on the first answer that names a row: the moment line's top a third down the tile. */
  const seat = (): void => {
    if (seated || !answer?.key) return;
    const line = o.drawn.node('moment:');
    if (!line?.isConnected) return;
    seated = true;
    const third = Math.round(o.el.clientHeight / 3);
    const top = line.getBoundingClientRect().top;
    const content = (n: Element | null): n is HTMLElement =>
      n instanceof HTMLElement && !/^(day|moment):/.test(n.dataset.key ?? 'moment:');
    let next: Element | null = line.nextElementSibling;
    while (next && !content(next)) next = next.nextElementSibling;
    let prev: Element | null = line.previousElementSibling;
    while (prev && !content(prev)) prev = prev.previousElementSibling;
    const row = (next ?? prev) as HTMLElement | null;
    if (!row?.dataset.key) return;
    o.keeper.set({ key: row.dataset.key, off: third + row.getBoundingClientRect().top - top });
  };

  return {
    /** The window around the time, as large as the sides have grown. */
    ask: (): void => o.request({ at }, ...sides),
    /** The author whose Home this is, once known: their face goes on the moment line. */
    met(person: Author): void {
      author = person;
      o.sync();
    },
    /** The engine's rows with the moment line where the time falls and what each end says. */
    plan(rows: readonly Row[]): readonly (Row | MomentPart)[] {
      const line: MomentPart = {
        kind: 'moment-part',
        key: 'moment:',
        at,
        author,
        follows: answer?.followList?.state === 'latest-verified' ? answer.followList.at : null,
        // The whole window is this device's only while neither side reads relays; else each end says its own.
        device: answer?.newer === 'cache-only' && answer?.older === 'cache-only',
      };
      const out: (Row | MomentPart)[] = [];
      const top = end(0, rows);
      if (top) out.push({ kind: 'moment-part', key: 'moment:newer', at, end: top });
      let placed = false;
      for (const r of rows) {
        if (!placed && r.kind === 'note' && rowTime(r) <= at) out.push(line), (placed = true);
        out.push(r);
      }
      if (!placed) out.push(line);
      const bottom = end(1, rows);
      if (bottom) out.push({ kind: 'moment-part', key: 'moment:older', at, end: bottom });
      return out;
    },
    answer(next: TimeWindow): void {
      answer = next;
      answered = sides;
      asked = false;
      o.sync();
      seat();
    },
    /** As the reader nears an end that has more, that side grows; past the bound the far side gives way, only
     * while it is out of sight. Undefined: nothing to ask. */
    follow(rows: readonly Row[]): void {
      if (asked || !answered || !answer || answer.newer === 'unsupported') return;
      const { el } = o;
      const [newer, older] = counts(rows);
      let [n, m] = sides;
      if (el.scrollTop < NEAR_PX && newer >= answered[0]) n = Math.min(LIMIT, n + STEP);
      else if (el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_PX && older >= answered[1])
        m = Math.min(LIMIT, m + STEP);
      if (n + m > LIMIT) {
        if (n > sides[0] && far(1)) m = LIMIT - n;
        else if (m > sides[1] && far(0)) n = LIMIT - m;
        else return;
      }
      if (n === sides[0] && m === sides[1]) return;
      sides = [n, m];
      o.state.sides = sides;
      o.save();
      asked = true;
      o.request({ at }, n, m);
    },
  };
}
