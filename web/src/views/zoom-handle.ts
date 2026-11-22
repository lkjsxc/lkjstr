// The percentage in a picture's bar is a handle for one finger or the mouse (owner, 2026-11-22): held and slid
// right or up, the picture comes twice as close every 100px, about the middle of the stage; left or down it goes
// away again. It has no end: lifted and slid again, it goes on from where it is. A press without a slide fits the
// picture or goes closer, as Enter and Space do.
import type { Zoom } from './zoom.ts';

const DOUBLING_PX = 100;
const SLOP_PX = 4; // a press that moved less is a press

export function zoomHandle(el: HTMLButtonElement, zoom: () => Zoom | undefined): () => void {
  let held: { id: number; x: number; y: number; at: number; slid: boolean } | undefined;
  const down = (e: PointerEvent): void => {
    if (e.button !== 0 || !zoom()) return;
    el.setPointerCapture(e.pointerId);
    held = { id: e.pointerId, x: e.clientX, y: e.clientY, at: 0, slid: false };
    el.classList.add('held');
  };
  const move = (e: PointerEvent): void => {
    if (!held || e.pointerId !== held.id) return;
    const along = e.clientX - held.x - (e.clientY - held.y);
    if (!held.slid && Math.hypot(e.clientX - held.x, e.clientY - held.y) < SLOP_PX) return;
    held.slid = true;
    const z = zoom();
    // Each move multiplies the scale by its own distance, so a slide back from either bound acts at once.
    if (z) z.set(z.scale() * 2 ** ((along - held.at) / DOUBLING_PX));
    held.at = along;
  };
  // A press is told by its release, not by a click: a browser drops the click of a tap that stops a fling.
  const up = (e: PointerEvent): void => {
    if (!held || e.pointerId !== held.id) return;
    const slid = held.slid;
    held = undefined;
    el.classList.remove('held');
    if (e.type === 'pointercancel') return;
    if (slid) zoom()?.settle();
    else zoom()?.toggle();
  };
  /** Enter and Space: a click with no pointer behind it. */
  const key = (e: MouseEvent): void => void (e.detail === 0 && zoom()?.toggle());
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('click', key);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('click', key);
  };
}
