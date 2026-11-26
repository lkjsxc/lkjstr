// Time rail input and drawing. See docs/interface-time.md.
import type { Anchor, Timeline } from '../engine/protocol.ts';
import { localZone } from '../shared/format.ts';
import type { Keeper, Place } from './feed-place.ts';
import { type RailRow, rowTime, timeText, topRow } from './feed-scrub.ts';
import { scrollIntent } from './scroll-intent.ts';
import { dayText, railDays } from './time-days.ts';
import {
  createMarkPainter,
  createTimeRailNodes,
  drawCurrentYear,
  drawLabel,
  fitTimeRail,
  loadingText,
  scrolledY,
  scrollShare,
} from './time-draw.ts';
import { railInput } from './time-input.ts';
import { type Label, snap } from './time-marks.ts';
import { nearPlace } from './time-near.ts';
import { createTimePreview, dated } from './time-preview.ts';
import { noteToPlace, placeToNote, type TimePlace, timeScale } from './time-scale.ts';
import { createSeeker } from './time-seek.ts';

const LATE_MS = 500;
const LANDED_MS = 1000;
export function mountTimeRail(o: {
  candidate(): boolean;
  version(): number;
  el: HTMLElement;
  list: HTMLElement;
  tail: HTMLElement;
  keeper: Keeper;
  rows(): readonly RailRow[];
  ensure?(key: string): void;
  seek(anchor: Anchor): void;
  seekExpired?(): void;
  active(): boolean;
}) {
  const { el, list, keeper } = o;
  const { rail, marks, lens, grip, hoverLine, tick, label, live, pin } = createTimeRailNodes(el);
  const painter = createMarkPainter(marks, lens);
  let telling = false; // the reader is scrolling (C1)
  const intent = scrollIntent(el, () => ((telling = false), sync()));
  const available = (): boolean => o.candidate() && o.version() >= 5;
  el.classList.toggle('has-time-rail', available());
  let data: Timeline | undefined;
  let shape: Timeline | undefined; // what the map is drawn from; frozen while a press is held
  let zone = localZone();
  let bands = timeScale([], 0);
  let axis = { inset: 0, height: 1 };
  let labels: readonly Label[] = [];
  const preview = createTimePreview();
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
    topRow(el, list, (key) => o.rows().find((r) => r.key === key)) ?? o.rows().findLast(dated);
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
    expired() {
      clearTimeout(lateTimer);
      late = speak = false;
      o.seekExpired?.();
    },
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
    const target = s.waiting ?? s.pending;
    let text = '';
    let y = lineY;
    if (held) {
      const at = plain ? readingAt(row) : 0;
      text = under ? textFor(under) : at ? timeText(at) : '';
      y = pointerY + axis.inset;
    } else if (target) {
      text = loadingText(textFor(target), late || Boolean(s.waiting));
      y = axis.inset + noteToPlace(bands, target);
    } else if (telling || landed || (plain && row)) text = timeText(readingAt(row));
    else if (hoverY !== undefined) (text = textFor(at(hoverY))), (y = hoverY + axis.inset);
    if (landed && speak && text) (speak = false), (live.textContent = text);
    drawLabel(label, text, y, el.clientHeight);
  };
  const paint = (): void => {
    frame = 0;
    const view = el.clientHeight;
    if (!held) shape = data; // Freeze the map and scroll mode until release, even before the first count.
    const counted = Boolean(shape?.supported && shape.months.length);
    const visible = available() && (data?.supported !== false || data.provisional === true);
    el.classList.toggle('has-time-rail', visible);
    plain = !counted && visible;
    const rows = o.rows();
    const needsGrip = rows.some(dated) || el.scrollHeight > view + 1;
    rail.hidden = !view || !visible;
    grip.hidden = !needsGrip;
    rail.classList.toggle('empty', !needsGrip);
    rail.classList.toggle('plain', plain);
    if (rail.hidden) return;
    axis = fitTimeRail(rail, view);
    const { height, inset } = axis;
    bands = timeScale(plain ? [] : (shape?.months ?? []), height);
    rail.classList.toggle('open-end', data?.older === true);
    const wide = rail.offsetWidth > 16;
    const loaded = plain ? preview.read(rows, zone, held) : undefined;
    const local = Boolean(loaded || days());
    labels = painter.draw(
      loaded ? timeScale(loaded.months, height) : bands,
      loaded ?? shape,
      height,
      wide,
      zone,
      local,
    );
    painter.lens(held ? pointerY : undefined, height);
    seeker.settle(data);
    const row = first();
    const p = near(row);
    drawCurrentYear(marks, local ? readingAt(row) : (p?.month ?? data?.months[0]?.at ?? 0), local);
    const y = held ? pointerY : p && !plain ? noteToPlace(bands, p) : scrolledY(el, height);
    const centre = Math.min(view - inset, Math.max(inset, y + inset));
    grip.style.top = `${centre}px`;
    tell(centre, row);
    tick.hidden = !s.back;
    if (s.back) tick.style.top = `${inset + noteToPlace(bands, s.back.time)}px`;
    const pointed = held ? pointerY : hoverY;
    hoverLine.hidden = pointed === undefined || rail.classList.contains('touch');
    hoverLine.style.top = `${inset + (pointed ?? 0)}px`;
  };
  const sync = (): void => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const drag = (y: number): void => {
    pointerY = y;
    if (plain) return void (scrollShare(el, y / axis.height), sync());
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
    y: (e) =>
      Math.max(0, Math.min(axis.height, e.clientY - rail.getBoundingClientRect().top - axis.inset)),
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
  const scrolled = (): void => {
    if (intent.telling()) telling = true;
    sync();
  };
  el.addEventListener('scroll', scrolled, { passive: true });
  const watch = new ResizeObserver(sync);
  watch.observe(el);
  watch.observe(list);
  sync();
  const stop = (): void => {
    seeker.stop(), clearTimeout(lateTimer), clearTimeout(landTimer);
    late = landed = speak = false;
    input.cancel();
  };
  return {
    sync,
    rowsChanged() {
      const hasRows = available() && o.rows().some(dated);
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
      if (!next.supported && (!next.provisional || data?.supported)) stop(), (s.back = undefined);
      data = next;
      placed = new Map(next.positions.map((p) => [p.key, p]));
      seeker.timeline(next);
      sync();
    },
    reset() {
      stop();
      (data = shape = s.back = undefined), (placed = new Map());
      preview.clear();
      o.tail.style.height = '';
      sync();
    },
    dispose() {
      stop();
      cancelAnimationFrame(frame);
      watch.disconnect();
      intent.dispose();
      input.dispose();
      pin.remove();
      el.classList.remove('has-time-rail');
      el.removeEventListener('scroll', scrolled);
      document.removeEventListener('visibilitychange', zoned);
    },
  };
}
