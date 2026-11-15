// The rail owns only pixels and input. Membership and note ordinals come from the engine.
import type { Anchor, Row, Timeline } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { typing } from '../shared/keys.ts';
import { popoverOpen } from '../wm/menus.ts';
import type { Keeper, Place } from './feed-place.ts';
import { rowTime, scrubText } from './feed-scrub.ts';
import { noteToPlace, placeToNote, type TimePlace, timeMarks, timeScale } from './time-scale.ts';
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
  const tick = h('div', { class: 'time-return', hidden: true });
  const label = h('div', { class: 'scrub', hidden: true });
  rail.append(marks, line, tick, label);
  const pin = h('div', { class: 'time-pin' }, rail);
  el.prepend(pin);
  el.classList.toggle('has-time-rail', o.candidate && o.version() >= 5);
  let data: Timeline | undefined;
  let bands = timeScale([], 0);
  let height = 0;
  let held = false;
  let pointer: number | undefined;
  let pending: TimePlace | undefined;
  let windowVersion = 0;
  let timelineVersion = 0;
  let pendingVersion = 0;
  let back: { place: Place; time: TimePlace } | undefined;
  let returning = false;
  let origin: typeof back;
  let frame = 0;
  let seekTimer: ReturnType<typeof setTimeout> | undefined;
  let queued: TimePlace | undefined;
  let under: TimePlace | undefined;
  const first = (): Row | undefined => {
    const top = el.getBoundingClientRect().top;
    const kids = list.children;
    let lo = 0;
    let hi = kids.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (kids[mid]!.getBoundingClientRect().bottom > top + 1) hi = mid;
      else lo = mid + 1;
    }
    for (let i = lo; i < kids.length; i++) {
      const key = (kids[i] as HTMLElement).dataset.key;
      const row = o.rows().find((r) => r.key === key);
      if (row?.kind === 'note' || row?.kind === 'notification') return row;
    }
    return o.rows().findLast((r) => r.kind === 'note' || r.kind === 'notification');
  };
  const position = (key: string | undefined) => data?.positions.find((p) => p.key === key);
  const current = (): typeof back => {
    const row = first();
    const time = position(row?.key);
    if (!row || !time) return;
    const node = [...list.children].find((n) => (n as HTMLElement).dataset.key === row.key);
    return {
      time,
      place: {
        key: row.key,
        off: (node?.getBoundingClientRect().top ?? 0) - el.getBoundingClientRect().top,
      },
    };
  };
  const scrollTo = (p: TimePlace, saved?: Place): boolean => {
    const key = data?.positions.find((r) => r.month === p.month && r.offset === p.offset)?.key;
    const node = [...list.children].find((n) => (n as HTMLElement).dataset.key === key) as
      | HTMLElement
      | undefined;
    if (!key || !node) return false;
    // Allow even the oldest note to stand at the top after a seek, as in a focused thread.
    const footer = o.tail.previousElementSibling?.getBoundingClientRect().height ?? 0;
    o.tail.style.height = `${Math.max(0, el.clientHeight - node.offsetHeight - footer)}px`;
    keeper.set(saved ?? { key, off: 0 });
    return true;
  };
  const say = (p: TimePlace): void => {
    const key = data?.positions.find((r) => r.month === p.month && r.offset === p.offset)?.key;
    const row = o.rows().find((r) => r.key === key);
    label.hidden = !row;
    if (row) label.textContent = scrubText(rowTime(row), data?.newest ?? 0, data?.oldest ?? 0);
  };
  const paint = (): void => {
    frame = 0;
    const show = Boolean(
      data?.supported && data.months.length && el.scrollHeight > el.clientHeight + 1,
    );
    rail.hidden = !show;
    el.classList.toggle('has-time-rail', data?.supported ?? (o.candidate && o.version() >= 5));
    el.style.setProperty('--rail-size', el.offsetWidth >= 520 ? '56px' : '16px');
    height = Math.max(1, el.clientHeight - 16);
    bands = timeScale(data?.months ?? [], height);
    if (!show) return;
    rail.style.top = '0px';
    rail.style.height = `${el.clientHeight}px`;
    rail.classList.toggle('wide', el.offsetWidth >= 520);
    rail.classList.toggle('open-end', data?.older === true);
    marks.replaceChildren(
      ...timeMarks(bands, height).flatMap((m) => [
        h(
          'span',
          {
            class: m.year === undefined ? 'time-dot' : 'time-year',
            style: `top: ${m.y + 8}px`,
          },
          m.year === undefined ? '' : String(m.year),
        ),
        ...(m.year === undefined
          ? []
          : [
              h('span', {
                class: 'time-dot year-month-dot',
                style: `top: ${(m.begin ?? m.y) + 8}px`,
              }),
            ]),
      ]),
    );
    const applied = timelineVersion > pendingVersion;
    const requested = applied && data?.positions.find((p) => p.key === data?.anchor);
    const target =
      requested || (applied && data?.anchor ? data.positions[0] : undefined) || pending;
    if (pending && target && scrollTo(target, returning ? back?.place : undefined)) {
      pending = undefined;
      if (returning) (back = undefined), (returning = false);
    }
    if (held && under) say(under);
    const p = position(first()?.key);
    const year = String(new Date(p?.month ?? data?.months[0]?.at ?? 0).getUTCFullYear());
    for (const number of marks.querySelectorAll('.time-year'))
      number.classList.toggle('current', number.textContent === year);
    line.style.top = `${8 + (p ? noteToPlace(bands, p) : 0)}px`;
    tick.hidden = !back;
    if (back) tick.style.top = `${8 + noteToPlace(bands, back.time)}px`;
  };
  const sync = (): void => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const go = (p: TimePlace): void => {
    if (!returning) back = held ? origin : current();
    if (scrollTo(p)) {
      pending = undefined;
      sync();
      return;
    }
    pending = p;
    pendingVersion = windowVersion;
    o.seek({ ...p, returnKey: back?.place.key });
    sync();
  };
  const flush = (): void => {
    clearTimeout(seekTimer);
    seekTimer = undefined;
    const p = queued;
    queued = undefined;
    if (p) go(p);
  };
  const move = (e: PointerEvent): void => {
    if (!held) return;
    const y = Math.max(0, Math.min(height, e.clientY - rail.getBoundingClientRect().top - 8));
    const p = placeToNote(bands, y);
    if (!p) return;
    under = p;
    say(p);
    label.style.top = `${y + 8}px`;
    queued = p;
    seekTimer ??= setTimeout(flush, 80);
  };
  const end = (): void => {
    if (held) flush();
    held = false;
    under = undefined;
    pointer = undefined;
    origin = undefined;
    rail.classList.remove('held');
    label.hidden = true;
  };
  const down = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.focus({ preventScroll: true });
    if (e.target === tick && back) {
      returning = true;
      if (scrollTo(back.time, back.place)) (back = undefined), (returning = false), sync();
      else (pending = back.time), (pendingVersion = windowVersion), o.seek({ key: back.place.key });
      return;
    }
    back = undefined;
    returning = false;
    origin = current();
    held = true;
    pointer = e.pointerId;
    rail.setPointerCapture(e.pointerId);
    rail.classList.add('held');
    move(e);
    flush();
  };
  const drag = (e: PointerEvent): void => {
    if (e.pointerId === pointer) move(e);
  };
  const key = (e: KeyboardEvent): void => {
    if (
      rail.hidden ||
      !data?.supported ||
      !o.active() ||
      popoverOpen() ||
      typing(e) ||
      e.defaultPrevented ||
      e.altKey ||
      e.metaKey
    )
      return;
    if (e.key !== 'Home' && e.key !== 'End') return;
    const b = e.key === 'Home' ? bands[0] : bands.at(-1);
    if (b)
      e.preventDefault(),
        (back = undefined),
        go({ month: b.at, offset: e.key === 'Home' ? 0 : b.count - 1 });
  };
  rail.addEventListener('pointerdown', down);
  rail.addEventListener('pointermove', drag);
  rail.addEventListener('pointerup', end);
  rail.addEventListener('pointercancel', end);
  window.addEventListener('blur', end);
  // Capture runs before the existing feed Home shortcut.
  window.addEventListener('keydown', key, true);
  el.addEventListener('scroll', sync, { passive: true });
  const watch = new ResizeObserver(sync);
  watch.observe(el);
  watch.observe(list);
  return {
    sync,
    window() {
      windowVersion++;
      sync();
    },
    busy: () => Boolean(pending || held),
    timeline(next: Timeline) {
      if (!next.supported) {
        queued = undefined;
        end();
        pending = undefined;
        back = undefined;
      }
      data = next;
      timelineVersion = windowVersion;
      const returned = back && next.positions.find((p) => p.key === back?.place.key);
      if (back && returned) back = { ...back, time: returned };
      sync();
    },
    reset() {
      queued = undefined;
      end();
      data = undefined;
      back = pending = undefined;
      o.tail.style.height = '';
      sync();
    },
    dispose() {
      queued = undefined;
      end();
      cancelAnimationFrame(frame);
      watch.disconnect();
      pin.remove();
      el.classList.remove('has-time-rail');
      el.removeEventListener('scroll', sync);
      window.removeEventListener('blur', end);
      window.removeEventListener('keydown', key, true);
    },
  };
}
