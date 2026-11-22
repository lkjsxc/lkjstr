// The rail owns only pixels and input. Membership, note ordinals and local days come from the engine
// (docs/interface-time.md: C1 the label while scrolling, C2 the marks and hover, C3 jumps and their loading).
import type { Anchor, Row, Timeline } from '../engine/protocol.ts';
import { localZone } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import type { Keeper, Place } from './feed-place.ts';
import { centred, rowTime, timeText, topRow } from './feed-scrub.ts';
import { railGuess, railSaid } from './rail-guess.ts';
import { scrollIntent } from './scroll-intent.ts';
import { dayText, railDays } from './time-days.ts';
import { railInput } from './time-input.ts';
import { boundaries, type Label, planMarks, snap } from './time-marks.ts';
import { noteToPlace, placeToNote, type TimePlace, timeScale } from './time-scale.ts';
import { createSeeker } from './time-seek.ts';

const LATE_MS = 500; // a jump still loading this long after its seek says so
const LANDED_MS = 1000; // the label stays this long after a jump lands

export function mountTimeRail(o: {
  candidate: boolean;
  version(): number;
  el: HTMLElement;
  list: HTMLElement;
  tail: HTMLElement;
  keeper: Keeper;
  rows(): readonly Row[];
  seek(anchor: Anchor): void;
  active(): boolean;
}) {
  const { el, list, keeper } = o;
  // A zero-height sticky holder survives WM reparenting and scrolls independently of the filter.
  const rail = h('div', { class: 'time-rail', hidden: true, 'aria-hidden': 'true' });
  const marks = h('div', { class: 'time-marks' });
  const line = h('div', { class: 'time-place' });
  const hoverLine = h('div', { class: 'time-hover', hidden: true });
  const tick = h('div', { class: 'time-return', hidden: true });
  const label = h('div', { class: 'scrub', hidden: true });
  const live = h('div', { class: 'vh', 'aria-live': 'polite' }); // where a key jump landed
  rail.append(marks, hoverLine, line, tick, label);
  const pin = h('div', { class: 'time-pin' }, rail, live);
  el.prepend(pin);
  let telling = false; // the reader is scrolling (C1)
  const intent = scrollIntent(el, () => ((telling = false), sync()));
  // The view's tab kind (set before mounting) keys what the engine last said, so the first frame has the final width.
  const kind = el.dataset.kind ?? '';
  const guess = (): boolean => o.candidate && o.version() >= 5 && railGuess(kind);
  el.classList.toggle('has-time-rail', guess());
  let data: Timeline | undefined;
  let shape: Timeline | undefined; // what the map is drawn from; frozen while a press is held
  let zone = localZone();
  let bands = timeScale([], 0);
  let height = 0;
  let labels: readonly Label[] = [];
  let drawn: { shape?: Timeline; key: string } = { key: '' };
  let frame = 0;
  let held = false;
  let under: TimePlace | undefined;
  let pointerY = 0;
  let hoverY: number | undefined;
  let late = false;
  let landed = false;
  let speak = false;
  let lateTimer: ReturnType<typeof setTimeout> | undefined;
  let landTimer: ReturnType<typeof setTimeout> | undefined;
  const first = (): Row | undefined =>
    (topRow(el, list, (key) => o.rows().find((r) => r.key === key)) as Row | undefined) ??
    o.rows().findLast((r) => r.kind === 'note' || r.kind === 'notification');
  const position = (key: string | undefined) => data?.positions.find((p) => p.key === key);
  const keyAt = (p: TimePlace) =>
    data?.positions.find((r) => r.month === p.month && r.offset === p.offset)?.key;
  const days = () => railDays(shape, zone);
  const current = () => {
    const row = first();
    const time = position(row?.key);
    if (!row || !time) return;
    const node = [...list.children].find((n) => (n as HTMLElement).dataset.key === row.key);
    const off = (node?.getBoundingClientRect().top ?? 0) - el.getBoundingClientRect().top;
    return { time, place: { key: row.key, off } };
  };
  const seeker = createSeeker({
    scrollTo(p: TimePlace, saved?: Place): boolean {
      const key = keyAt(p);
      const node = [...list.children].find((n) => (n as HTMLElement).dataset.key === key) as
        | HTMLElement
        | undefined;
      if (!key || !node) return false;
      // Allow even the oldest note to stand at the top after a seek, as in a focused thread.
      const footer = o.tail.previousElementSibling?.getBoundingClientRect().height ?? 0;
      o.tail.style.height = `${Math.max(0, el.clientHeight - node.offsetHeight - footer)}px`;
      keeper.set(saved ?? { key, off: 0 });
      return true;
    },
    seek: (anchor) => o.seek(anchor),
    current,
    sent() {
      clearTimeout(lateTimer);
      late = false;
      lateTimer = setTimeout(() => ((late = true), sync()), LATE_MS);
    },
    landed: () => land(),
    sync: () => sync(),
  });
  const { s } = seeker;
  const land = (): void => {
    clearTimeout(lateTimer);
    late = false;
    if (held) return;
    landed = true;
    clearTimeout(landTimer);
    landTimer = setTimeout(() => ((landed = false), sync()), LANDED_MS);
  };
  /** The full time of a loaded note; else its local day; else nothing. Never a minute it does not know. */
  const textFor = (p: TimePlace): string => {
    const key = keyAt(p);
    const at = rowTime(key ? o.rows().find((r) => r.key === key) : undefined);
    return at ? timeText(at) : dayText(days(), p);
  };
  /** The note under `y`, or the period of a label whose centre is within 6px. */
  const at = (y: number): TimePlace =>
    snap(labels, y)?.place ?? placeToNote(bands, y) ?? { month: 0, offset: 0 };
  // Held, it says the target at the pointer; loading, the target's day where it is going; landed or scrolling, the
  // row at the top beside the place line; hovered, the note under the pointer.
  const tell = (lineY: number): void => {
    let text = '';
    let y = lineY;
    if (held && under) (text = textFor(under)), (y = pointerY + 8);
    else if (s.pending) {
      const day = textFor(s.pending);
      text = day && `${day}${late ? ' …' : ''}`;
      y = 8 + noteToPlace(bands, s.pending);
    } else if (telling || landed) text = timeText(rowTime(first()));
    else if (hoverY !== undefined) (text = textFor(at(hoverY))), (y = hoverY + 8);
    if (landed && speak && text) (speak = false), (live.textContent = text);
    label.hidden = !text;
    if (!text) return;
    label.textContent = text;
    label.style.top = `${centred(label, y, el.clientHeight)}px`;
  };
  const paint = (): void => {
    frame = 0;
    const show = Boolean(
      data?.supported && data.months.length && el.scrollHeight > el.clientHeight + 1,
    );
    rail.hidden = !show;
    // An answer with no months yet (a Home before its follows arrive) still says nothing about the width.
    const said = data && (!data.supported || data.months.length) ? data.supported : undefined;
    el.classList.toggle('has-time-rail', said ?? guess());
    if (!held) shape = data;
    height = Math.max(1, el.clientHeight - 16);
    bands = timeScale(shape?.months ?? [], height);
    if (!show) return;
    rail.style.top = '0px';
    rail.style.height = `${el.clientHeight}px`;
    rail.classList.toggle('open-end', data?.older === true);
    const wide = rail.offsetWidth > 16;
    const local = days();
    // Marks are planned again when what they are drawn from changes, not on every scroll.
    const key = `${height}:${wide}:${zone}`;
    if (shape !== drawn.shape || key !== drawn.key) {
      drawn = { shape, key };
      const plan = planMarks(boundaries(bands, local), height, wide);
      labels = plan.labels;
      const top = (y: number): string => `top: ${y + 8}px`;
      marks.replaceChildren(
        ...plan.dots.map((d) =>
          h('span', { class: d.size === 2 ? 'time-dot fine' : 'time-dot', style: top(d.y) }),
        ),
        ...plan.labels.map((l) =>
          h('span', { class: `time-label time-${l.level}`, style: top(l.centre) }, l.text),
        ),
      );
    }
    seeker.settle(data);
    const row = first();
    const p = position(row?.key);
    const year = local
      ? new Date(rowTime(row)).getFullYear()
      : new Date(p?.month ?? data?.months[0]?.at ?? 0).getUTCFullYear();
    for (const number of marks.querySelectorAll('.time-year'))
      number.classList.toggle('current', number.textContent === String(year));
    line.style.top = `${8 + (p ? noteToPlace(bands, p) : 0)}px`;
    tell(Number.parseFloat(line.style.top));
    tick.hidden = !s.back;
    if (s.back) tick.style.top = `${8 + noteToPlace(bands, s.back.time)}px`;
    const pointed = held ? pointerY : hoverY;
    hoverLine.hidden = pointed === undefined || rail.classList.contains('touch');
    hoverLine.style.top = `${8 + (pointed ?? 0)}px`;
  };
  const sync = (): void => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const drag = (y: number): void => {
    pointerY = y;
    under = at(y);
    seeker.queue(under);
    sync();
  };
  const end = (): void => {
    const was = held;
    held = false;
    under = undefined;
    if (was) seeker.flush();
    if (was && !s.pending) land(); // a released rail tells where it went, then goes
    s.origin = undefined;
    rail.classList.remove('held', 'touch');
    sync();
  };
  const input = railInput({
    el,
    rail,
    tick,
    y: (e) => Math.max(0, Math.min(height, e.clientY - rail.getBoundingClientRect().top - 8)),
    press(y, touch) {
      s.back = undefined;
      s.returning = false;
      s.origin = current();
      held = true;
      rail.classList.add('held');
      rail.classList.toggle('touch', touch);
      drag(y);
      seeker.flush();
    },
    drag,
    release: end,
    hover: (y) => void ((hoverY = y), sync()),
    back: (said) => Boolean(s.back) && ((speak = said), seeker.ret()),
    usable: () => !rail.hidden && Boolean(data?.supported) && o.active() && !held && !s.returning,
    jump(to) {
      const p = to(s.waiting ?? s.pending ?? position(first()?.key), bands, days());
      if (!p) return false;
      s.back = undefined;
      speak = true;
      seeker.go(p);
      return true;
    },
  });
  const zoned = (): void => void ((zone = localZone()), sync());
  document.addEventListener('visibilitychange', zoned);
  window.addEventListener('blur', end);
  const scrolled = (): void => {
    if (intent.telling()) telling = true;
    sync();
  };
  el.addEventListener('scroll', scrolled, { passive: true });
  const watch = new ResizeObserver(sync);
  watch.observe(el);
  watch.observe(list);
  const stop = (): void => {
    seeker.stop(), clearTimeout(lateTimer), clearTimeout(landTimer);
    late = landed = speak = false;
    end();
  };
  return {
    sync,
    window() {
      seeker.window();
      sync();
    },
    busy: () => Boolean(s.pending || s.inflight || held),
    timeline(next: Timeline) {
      // Refused mid-drag: the hold ends and the list stays where it is.
      if (!next.supported) stop(), (s.back = undefined);
      data = next;
      if (o.candidate && (!next.supported || next.months.length)) railSaid(kind, next.supported);
      seeker.timeline(next);
      sync();
    },
    reset() {
      stop();
      data = shape = s.back = undefined;
      o.tail.style.height = '';
      sync();
    },
    dispose() {
      stop();
      cancelAnimationFrame(frame);
      watch.disconnect();
      intent.dispose();
      input();
      pin.remove();
      el.classList.remove('has-time-rail');
      el.removeEventListener('scroll', scrolled);
      document.removeEventListener('visibilitychange', zoned);
      window.removeEventListener('blur', end);
    },
  };
}
