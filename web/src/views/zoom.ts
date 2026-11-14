// A picture that can be looked at closely: wheel and pinch zoom about the pointer, drag to pan, double press for
// fit or actual size. The picture never leaves the stage, and a stage that changes size keeps a fitted picture fitted.
export type Zoom = {
  /** Fits the picture, or shows it at its own size when it is fitted. */
  toggle(): void;
  by(factor: number): void;
  dispose(): void;
};
export type ZoomEvents = {
  /** The scale changed (1 is the picture's own size). */
  scale(scale: number, fitted: boolean): void;
  /** A sideways flick across a fitted picture: -1 back, 1 forward. */
  flick(dir: -1 | 1): void;
};

const MAX = 8;

export function zoomable(
  stage: HTMLElement,
  img: HTMLImageElement,
  known: { w?: number; h?: number },
  on: ZoomEvents,
): Zoom {
  let nw = known.w ?? 0;
  let nh = known.h ?? 0;
  let s = 1;
  let x = 0;
  let y = 0;
  let fitted = true;
  const points = new Map<number, { x: number; y: number }>(); // bound: fingers on the stage
  let start: { x: number; y: number; moved: boolean } | undefined;
  let pinch = 0;

  const box = (): DOMRect => stage.getBoundingClientRect();
  const fitScale = (): number => {
    const b = box();
    return nw && nh ? Math.min(b.width / nw, b.height / nh, 1) : 1;
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
    stage.classList.toggle('pan', !fitted && (w > b.width || hh > b.height));
    on.scale(s, fitted);
  };
  /** Zooms to `next`, keeping the point of the picture under (`px`, `py`) where it is. */
  const zoomAt = (next: number, px: number, py: number): void => {
    const f = fitScale();
    const to = Math.min(MAX, Math.max(Math.min(f, 1), next));
    x = px - (px - x) * (to / s);
    y = py - (py - y) * (to / s);
    s = to;
    fitted = Math.abs(to - f) < 0.001;
    apply();
  };
  const centre = (): [number, number] => [box().width / 2, box().height / 2];
  const toggle = (px = centre()[0], py = centre()[1]): void => {
    if (fitted && fitScale() < 1) zoomAt(1, px, py);
    else if (fitted) zoomAt(2, px, py);
    else (fitted = true), apply();
  };

  const local = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const b = box();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const spread = (): { d: number; x: number; y: number } => {
    const [a, b] = [...points.values()];
    if (!a || !b) return { d: 0, x: 0, y: 0 };
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const wheel = (e: WheelEvent): void => {
    e.preventDefault();
    const p = local(e);
    zoomAt(s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), p.x, p.y);
  };
  const down = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    stage.setPointerCapture(e.pointerId);
    const p = local(e);
    points.set(e.pointerId, p);
    start = points.size === 1 ? { ...p, moved: false } : undefined;
    pinch = spread().d;
  };
  const move = (e: PointerEvent): void => {
    const was = points.get(e.pointerId);
    if (!was) return;
    const p = local(e);
    points.set(e.pointerId, p);
    if (points.size === 2) {
      const now = spread();
      if (pinch > 0 && now.d > 0) zoomAt(s * (now.d / pinch), now.x, now.y);
      pinch = now.d;
    } else if (!fitted) {
      x += p.x - was.x;
      y += p.y - was.y;
      apply();
    }
    if (start && Math.hypot(p.x - start.x, p.y - start.y) > 6) start.moved = true;
  };
  const up = (e: PointerEvent): void => {
    const p = points.get(e.pointerId);
    points.delete(e.pointerId);
    pinch = 0;
    if (!p || !start || points.size) return;
    const dx = p.x - start.x;
    if (
      fitted &&
      e.pointerType !== 'mouse' &&
      Math.abs(dx) > 56 &&
      Math.abs(dx) > 2 * Math.abs(p.y - start.y)
    )
      on.flick(dx < 0 ? 1 : -1);
    start = undefined;
  };
  const dbl = (e: MouseEvent): void => {
    const p = local(e);
    toggle(p.x, p.y);
  };
  const loaded = (): void => {
    if (!nw || !nh) (nw = img.naturalWidth), (nh = img.naturalHeight);
    apply();
  };
  stage.addEventListener('wheel', wheel, { passive: false });
  stage.addEventListener('pointerdown', down);
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', dbl);
  img.addEventListener('load', loaded);
  const sizes = new ResizeObserver(apply);
  sizes.observe(stage);
  img.style.visibility = 'hidden';
  apply();
  return {
    toggle: () => toggle(),
    by: (factor) => zoomAt(s * factor, ...centre()),
    dispose() {
      sizes.disconnect();
      stage.removeEventListener('wheel', wheel);
      stage.removeEventListener('pointerdown', down);
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
      stage.removeEventListener('dblclick', dbl);
      img.removeEventListener('load', loaded);
    },
  };
}
