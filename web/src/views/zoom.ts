// A picture looked at closely, with the feel of a map (owner, 2026-11-22): a finger or the mouse drags it, and a
// release carries it on and slows down; two fingers pinch about where they are while they move it; the wheel zooms
// about the pointer; a double tap or double click goes closer, or back to the whole picture, about that point, and
// every such jump in scale is drawn as a short slide, so nothing jumps. The scale has no step and no stop short of a
// 32px picture and 256 times its own size; the percentage in the bar is a handle for one finger (zoom-handle.ts).
// The picture never leaves the stage, a stage that changes size keeps a fitted picture fitted, and a scale let go
// near the fitted one settles on it.
export type ZoomPosition = { s: number; x: number; y: number; fitted: boolean };
export type Zoom = {
  /** Fits the picture, or goes closer when it is fitted. */
  toggle(): void;
  by(factor: number): void;
  scale(): number;
  /** Shows the picture at `scale` at once, about the middle of the stage. */
  set(scale: number): void;
  /** A slide of the scale has ended: close to the fitted size, the picture fits again. */
  settle(): void;
  dispose(): void;
};
export type ZoomEvents = {
  /** Where the picture is, a moment after it last moved. */
  changed?(position: ZoomPosition): void;
  /** The scale changed (1 is the picture's own size). */
  scale(scale: number, fitted: boolean): void;
  /** A sideways flick across a fitted picture: -1 back, 1 forward. */
  flick(dir: -1 | 1): void;
};

const MAX = 256;
const MIN_PX = 32; // the longer side of the smallest picture
const TAP_MS = 320; // two taps closer in time and place than this are a double tap
const TAP_PX = 24;
const SLIDE_MS = 220; // a jump in scale
const GLIDE_MS = 325; // how quickly a released picture slows down
const TRAIL_MS = 90; // how far back a release measures its speed
const SNAP = 0.05; // a scale this close to the fitted one fits

type Point = { x: number; y: number };

export function zoomable(
  stage: HTMLElement,
  img: HTMLImageElement,
  known: { w?: number; h?: number },
  on: ZoomEvents,
  saved?: ZoomPosition,
): Zoom {
  let nw = known.w ?? 0;
  let nh = known.h ?? 0;
  let s = saved?.s ?? 1;
  let x = saved?.x ?? 0;
  let y = saved?.y ?? 0;
  let fitted = saved?.fitted ?? true;
  const points = new Map<number, Point>(); // bound: fingers on the stage
  let last: (Point & { d: number }) | undefined; // the fingers' middle and spread at the previous move
  let press: (Point & { moved: boolean; touch: boolean }) | undefined; // a gesture of one pointer so far
  let tapped: (Point & { at: number }) | undefined;
  let trail: (Point & { t: number })[] = []; // bound: the moves of the last TRAIL_MS
  let frame = 0;
  let saving: ReturnType<typeof setTimeout> | undefined;

  const box = (): DOMRect => stage.getBoundingClientRect();
  const fitScale = (): number => {
    const b = box();
    return nw && nh ? Math.min(b.width / nw, b.height / nh, 1) : 1;
  };
  const bounded = (v: number): number =>
    Math.min(MAX, Math.max(Math.min(fitScale(), MIN_PX / Math.max(nw, nh, 1)), v));
  const near = (v: number): boolean => Math.abs(v / fitScale() - 1) < SNAP;
  const save = (): void => {
    clearTimeout(saving);
    saving = setTimeout(() => {
      saving = undefined;
      on.changed?.({ s, x, y, fitted });
    }, 200);
  };
  const apply = (): void => {
    if (!nw || !nh) return;
    const b = box();
    if (fitted) s = fitScale();
    const w = nw * s;
    const hh = nh * s;
    x = w <= b.width ? (b.width - w) / 2 : Math.min(0, Math.max(b.width - w, x));
    y = hh <= b.height ? (b.height - hh) / 2 : Math.min(0, Math.max(b.height - hh, y));
    img.style.width = `${nw}px`;
    img.style.height = `${nh}px`;
    img.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    img.style.visibility = 'visible';
    // Four screen pixels or more to one of the picture's: its pixels show as they are.
    img.style.imageRendering = s >= 4 ? 'pixelated' : '';
    stage.classList.toggle('pan', w > b.width + 0.5 || hh > b.height + 0.5);
    on.scale(s, fitted);
    save();
  };
  /** The picture's point under `from` goes under `to`, at scale `next`. */
  const place = (next: number, from: Point, to: Point = from): void => {
    const v = bounded(next);
    x = to.x - (from.x - x) * (v / s);
    y = to.y - (from.y - y) * (v / s);
    s = v;
    fitted = Math.abs(v - fitScale()) < 0.001;
    apply();
  };
  const stop = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const still = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Slides the scale to `target` about `p`. */
  const slide = (target: number, p: Point): void => {
    stop();
    const from = s;
    const to = bounded(target);
    const t0 = performance.now();
    const step = (now: number): void => {
      const k = still() ? 1 : Math.min(1, (now - t0) / SLIDE_MS);
      place(from * (to / from) ** (1 - (1 - k) ** 3), p);
      frame = k < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  };
  /** Carries the picture on at `v` (px per ms), slowing down, until it stops or meets an edge. */
  const glide = (v: Point): void => {
    stop();
    if (still()) return;
    let t = performance.now();
    const step = (now: number): void => {
      const dt = Math.min(48, now - t);
      t = now;
      const want = { x: x + v.x * dt, y: y + v.y * dt };
      x = want.x;
      y = want.y;
      apply();
      const decay = Math.exp(-dt / GLIDE_MS);
      v = {
        x: Math.abs(x - want.x) > 0.5 ? 0 : v.x * decay,
        y: Math.abs(y - want.y) > 0.5 ? 0 : v.y * decay,
      };
      frame = Math.hypot(v.x, v.y) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  };
  const centre = (): Point => ({ x: box().width / 2, y: box().height / 2 });
  const toggle = (p: Point = centre()): void => {
    const f = fitScale();
    if (fitted) slide(Math.max(1, 2 * f), p);
    else slide(f, p);
  };
  const settle = (): void => {
    if (!fitted && near(s)) slide(fitScale(), centre());
  };

  const local = (e: { clientX: number; clientY: number }): Point => {
    const b = box();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  /** The middle of the fingers, and how far apart the first two are. */
  const fingers = (): Point & { d: number } => {
    const all = [...points.values()];
    const [a, b] = all;
    const n = all.length || 1;
    return {
      x: all.reduce((sum, p) => sum + p.x, 0) / n,
      y: all.reduce((sum, p) => sum + p.y, 0) / n,
      d: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
    };
  };
  const wheel = (e: WheelEvent): void => {
    e.preventDefault();
    stop();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? box().height : 1;
    place(s * Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0016)), local(e));
  };
  const down = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    stop();
    stage.setPointerCapture(e.pointerId);
    const p = local(e);
    points.set(e.pointerId, p);
    last = fingers();
    trail = [];
    press =
      points.size === 1 ? { ...p, moved: false, touch: e.pointerType !== 'mouse' } : undefined;
    stage.classList.add('held');
  };
  const move = (e: PointerEvent): void => {
    if (!points.has(e.pointerId)) return;
    points.set(e.pointerId, local(e));
    const now = fingers();
    if (last && now.d > 0 && last.d > 0) place(s * (now.d / last.d), last, now);
    else if (last && !fitted) {
      x += now.x - last.x;
      y += now.y - last.y;
      apply();
    }
    last = now;
    trail = [...trail.filter((p) => e.timeStamp - p.t <= TRAIL_MS), { ...now, t: e.timeStamp }];
    if (press && Math.hypot(now.x - press.x, now.y - press.y) > 6) press.moved = true;
  };
  const up = (e: PointerEvent): void => {
    const p = points.get(e.pointerId);
    if (!p) return;
    points.delete(e.pointerId);
    last = points.size ? fingers() : undefined; // the fingers left go on from where they are
    trail = points.size ? [] : trail.filter((q) => e.timeStamp - q.t <= TRAIL_MS);
    if (points.size) return;
    stage.classList.remove('held');
    const gesture = press;
    press = undefined;
    if (e.type === 'pointercancel') return;
    const [first, end] = [trail[0], trail[trail.length - 1]];
    const dt = first && end ? end.t - first.t : 0;
    if (
      !fitted &&
      first &&
      end &&
      dt > 8 &&
      Math.hypot(end.x - first.x, end.y - first.y) / dt > 0.1
    )
      glide({ x: (end.x - first.x) / dt, y: (end.y - first.y) / dt });
    else settle();
    if (!gesture) return; // fingers that pinched make no tap
    if (!gesture.moved) {
      const double =
        tapped &&
        e.timeStamp - tapped.at < TAP_MS &&
        Math.hypot(p.x - tapped.x, p.y - tapped.y) < TAP_PX;
      tapped = double ? undefined : { ...p, at: e.timeStamp };
      if (double) toggle(p);
      return;
    }
    const dx = p.x - gesture.x;
    if (
      fitted &&
      gesture.touch &&
      Math.abs(dx) > 56 &&
      Math.abs(dx) > 2 * Math.abs(p.y - gesture.y)
    )
      on.flick(dx < 0 ? 1 : -1);
  };
  const keep = (e: Event): void => e.preventDefault(); // the browser's image drag and Safari's page pinch
  const loaded = (): void => {
    if (!nw || !nh) (nw = img.naturalWidth), (nh = img.naturalHeight);
    apply();
  };
  const events: [EventTarget, string, (e: never) => void][] = [
    [stage, 'pointerdown', down],
    [stage, 'pointermove', move],
    [stage, 'pointerup', up],
    [stage, 'pointercancel', up],
    [stage, 'dragstart', keep],
    [stage, 'gesturestart', keep],
    [stage, 'gesturechange', keep],
    [img, 'load', loaded],
  ];
  for (const [target, type, fn] of events) target.addEventListener(type, fn as EventListener);
  stage.addEventListener('wheel', wheel, { passive: false });
  const sizes = new ResizeObserver(apply);
  sizes.observe(stage);
  img.style.visibility = 'hidden';
  apply();
  return {
    toggle: () => toggle(),
    by: (factor) => slide(s * factor, centre()),
    scale: () => s,
    set(next) {
      stop();
      place(next, centre());
    },
    settle,
    dispose() {
      stop();
      sizes.disconnect();
      if (saving) clearTimeout(saving), on.changed?.({ s, x, y, fitted });
      for (const [target, type, fn] of events)
        target.removeEventListener(type, fn as EventListener);
      stage.removeEventListener('wheel', wheel);
    },
  };
}
