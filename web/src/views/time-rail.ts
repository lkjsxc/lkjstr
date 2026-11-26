// The rail owns only pixels and input. Membership, note ordinals and local days come from the engine
// (docs/interface-time.md: C1 the label while scrolling, C2 the marks and hover, C3 jumps and their loading).
import type { Anchor, Timeline } from '../engine/protocol.ts';
import { localZone } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import type { Keeper, Place } from './feed-place.ts';
import { centred, type RailRow, rowTime, timeText, topRow } from './feed-scrub.ts';
import { railGuess, railSaid } from './rail-guess.ts';
import { scrollIntent } from './scroll-intent.ts';
import { dayText, railDays } from './time-days.ts';
import { drawMarks, scrolledY, scrollShare } from './time-draw.ts';
import { railInput } from './time-input.ts';
import { type Label, snap } from './time-marks.ts';
import { nearPlace } from './time-near.ts';
import { noteToPlace, placeToNote, type TimePlace, timeScale } from './time-scale.ts';
import { createSeeker } from './time-seek.ts';

const LATE_MS = 500; // a jump still loading this long after its seek says so
const LANDED_MS = 1000; // the label stays this long after a jump lands
const timed = (r: RailRow): boolean =>
  r.kind === 'note' || r.kind === 'notification' || r.kind === 'dm';

export function mountTimeRail(o: {
  candidate: boolean;
  version(): number;
  key(kind: string): string; // the rail-guess key of this list's current mode
  el: HTMLElement;
  list: HTMLElement;
  tail: HTMLElement;
  keeper: Keeper;
  rows(): readonly RailRow[];
  ensure?(key: string): void;
  seek(anchor: Anchor): void;
  active(): boolean;
}) {
  const { el, list, keeper } = o;
  const rail = h('div', { class: 'time-rail', hidden: true, 'aria-hidden': 'true' });
  const marks = h('div', { class: 'time-marks' });
  const grip = h('div', { class: 'time-grip' });
  const hoverLine = h('div', { class: 'time-hover', hidden: true });
  const tick = h('div', { class: 'time-return', hidden: true });
  const label = h('div', { class: 'scrub', hidden: true });
  const live = h('div', { class: 'vh', 'aria-live': 'polite' }); // where a key jump landed
  rail.append(marks, hoverLine, grip, tick, label);
  const pin = h('div', { class: 'time-pin' }, rail, live);
  el.prepend(pin);
  let telling = false; // the reader is scrolling (C1)
  const intent = scrollIntent(el, () => ((telling = false), sync()));
  const kind = (): string => o.key(el.dataset.kind ?? '');
  const guess = (): boolean => o.candidate && o.version() >= 5 && railGuess(kind());
  el.classList.toggle('has-time-rail', guess());
  let data: Timeline | undefined;
  let shape: Timeline | undefined; // what the map is drawn from; frozen while a press is held
  let zone = localZone();
  let bands = timeScale([], 0);
  let height = 0;
  let labels: readonly Label[] = [];
  let drawn: { shape?: Timeline; key: string } = { key: '' };
  let frame = 0;
  let hadRows = false;
  let held = false;
  let plain = false; // nothing counted yet: the grip says only the share scrolled
  let under: TimePlace | undefined;
  let pointerY = 0;
  let hoverY: number | undefined;
  let late = false;
  let landed = false;
  let speak = false;
  let lateTimer: ReturnType<typeof setTimeout> | undefined;
  let landTimer: ReturnType<typeof setTimeout> | undefined;
  const first = (): RailRow | undefined =>
    topRow(el, list, (key) => o.rows().find((r) => r.key === key)) ?? o.rows().findLast(timed);
  let placed = new Map<string, Timeline['positions'][number]>();
  const position = (key: string | undefined) => (key === undefined ? undefined : placed.get(key));
  const near = (row: RailRow | undefined) => nearPlace(o.rows(), row?.key, position);
  const readingAt = (row: RailRow | undefined): number => position(row?.key)?.at ?? rowTime(row);
  const keyAt = (p: TimePlace) =>
    data?.positions.find((r) => r.month === p.month && r.offset === p.offset)?.key;
  const nodeOf = (key: string) =>
    [...list.children].find((n) => (n as HTMLElement).dataset.key === key) as
      | HTMLElement
      | undefined;
  const days = () => railDays(shape, zone);
  const current = () => {
    const row = first();
    const time = position(row?.key);
    if (!row || !time) return;
    const off =
      (nodeOf(row.key)?.getBoundingClientRect().top ?? 0) - el.getBoundingClientRect().top;
    return { time, place: { key: row.key, off } };
  };
  const seeker = createSeeker({
    scrollTo(p: TimePlace, saved?: Place): boolean {
      const key = keyAt(p);
      if (!key) return false;
      let node = nodeOf(key);
      if (!node && o.ensure) o.ensure(key), (node = nodeOf(key));
      if (!node) return false;
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
  const textFor = (p: TimePlace): string => {
    const key = keyAt(p);
    const at = readingAt(key ? o.rows().find((r) => r.key === key) : undefined);
    return at ? timeText(at) : dayText(days(), p);
  };
  const at = (y: number): TimePlace =>
    snap(labels, y)?.place ?? placeToNote(bands, y) ?? { month: 0, offset: 0 };
  const tell = (lineY: number, row: RailRow | undefined): void => {
    let text = '';
    let y = lineY;
    if (held) {
      const at = plain ? readingAt(row) : 0;
      text = under ? textFor(under) : at ? timeText(at) : '';
      y = pointerY + 8;
    } else if (s.pending) {
      const day = textFor(s.pending);
      text = day && `${day}${late ? ' …' : ''}`;
      y = 8 + noteToPlace(bands, s.pending);
    } else if (telling || landed) text = timeText(readingAt(row));
    else if (hoverY !== undefined) (text = textFor(at(hoverY))), (y = hoverY + 8);
    if (landed && speak && text) (speak = false), (live.textContent = text);
    label.hidden = !text;
    if (!text) return;
    label.textContent = text;
    label.style.top = `${centred(label, y, el.clientHeight)}px`;
  };
  const paint = (): void => {
    frame = 0;
    const view = el.clientHeight;
    if (!held) shape = data; // Freeze the map and scroll mode until release, even before the first count.
    const counted = Boolean(shape?.supported && shape.months.length);
    // An answer with no months yet (a Home before its follows arrive) still says nothing about the width.
    const said = data && (!data.supported || data.months.length) ? data.supported : undefined;
    el.classList.toggle('has-time-rail', said ?? guess());
    plain = !counted && el.classList.contains('has-time-rail');
    const needsGrip = o.rows().some(timed) || el.scrollHeight > view + 1;
    rail.hidden = !view || !(counted || plain) || !needsGrip;
    rail.classList.toggle('plain', plain);
    height = Math.max(1, view - 16);
    bands = timeScale(plain ? [] : (shape?.months ?? []), height);
    if (rail.hidden) return;
    rail.style.height = `${view}px`;
    rail.classList.toggle('open-end', data?.older === true);
    const wide = rail.offsetWidth > 16;
    const local = days();
    const key = `${height}:${wide}:${zone}:${plain}`;
    if (shape !== drawn.shape || key !== drawn.key) {
      drawn = { shape, key };
      labels = drawMarks(marks, bands, plain ? undefined : local, height, wide);
    }
    seeker.settle(data);
    const row = first();
    const p = near(row);
    const year = local
      ? new Date(readingAt(row)).getFullYear()
      : new Date(p?.month ?? data?.months[0]?.at ?? 0).getUTCFullYear();
    for (const number of marks.querySelectorAll('.time-year'))
      number.classList.toggle('current', number.textContent === String(year));
    const y = held ? pointerY : p && !plain ? noteToPlace(bands, p) : scrolledY(el, height);
    const centre = Math.min(view - 16, Math.max(16, y + 8));
    grip.style.top = `${centre}px`;
    tell(centre, row);
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
    if (plain) return void (scrollShare(el, y / height), sync());
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
    usable: () => !rail.hidden && !plain && o.active() && !held && !s.returning,
    jump(to) {
      const p = to(s.waiting ?? s.pending ?? near(first()), bands, days());
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
    rowsChanged() {
      // Paint the first grip with the drawn rows, after the keeper has restored their scroll.
      const hasRows = o.candidate && o.rows().some(timed);
      const firstRows = hasRows && (!hadRows || rail.hidden);
      hadRows = hasRows;
      if (!firstRows) return sync();
      cancelAnimationFrame(frame);
      paint();
    },
    window() {
      seeker.window();
      sync();
    },
    busy: () => Boolean(s.pending || s.inflight || held),
    timeline(next: Timeline) {
      if (!next.supported) stop(), (s.back = undefined);
      data = next;
      placed = new Map(next.positions.map((p) => [p.key, p]));
      if (o.candidate && (!next.supported || next.months.length)) railSaid(kind(), next.supported);
      seeker.timeline(next);
      sync();
    },
    reset() {
      stop();
      (data = shape = s.back = undefined), (placed = new Map());
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
