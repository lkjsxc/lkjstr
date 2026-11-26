// Pointer and keys on the time rail (docs/interface-time.md C3). Mouse, pen and touch share one path: pointer events
// on the rail, with capture; a touch grabs at once (the rail sets `touch-action: none`) and a tap is a press. A fine
// pointer over the rail hovers. The keys belong to the tile in front, never to a field or an open popover.
import { pressed, typing } from '../shared/keys.ts';
import { popoverOpen } from '../wm/menus.ts';
import { stepDay, stepMonth } from './time-days.ts';
import type { Day } from './time-marks.ts';
import type { TimeBand, TimePlace } from './time-scale.ts';

type Step = (
  from: TimePlace | undefined,
  bands: readonly TimeBand[],
  days?: readonly Day[],
) => TimePlace | undefined;

const ends =
  (newest: boolean): Step =>
  (_, bands) => {
    const b = newest ? bands[0] : bands.at(-1);
    return b && { month: b.at, offset: newest ? 0 : b.count - 1 };
  };
/** By one occupied local day; without days, or past the days the engine names, by one occupied month. Nothing at
 * the ends. */
const step =
  (dir: -1 | 1): Step =>
  (from, bands, days) =>
    from && ((days && stepDay(days, from, dir)) || stepMonth(bands, from, dir));

export function railInput(o: {
  readonly el: HTMLElement;
  readonly rail: HTMLElement;
  readonly tick: HTMLElement;
  /** The pointer's place on the map, in px. */
  y(e: PointerEvent): number;
  press(y: number, touch: boolean): void;
  drag(y: number): void;
  release(): void;
  hover(y: number | undefined): void;
  /** To the return tick; `said`: tell a screen reader where it landed. False without a tick. */
  back(said: boolean): boolean;
  /** The keys act now. */
  usable(): boolean;
  /** Jumps to where `to` says (from the place being read); false when it says nowhere. */
  jump(to: Step): boolean;
}) {
  const { el, rail } = o;
  let pointer: number | undefined;
  const clearPointerFocus = (): void => el.classList.remove('time-pointer-focus');
  const down = (e: PointerEvent): void => {
    if (e.button !== 0 || pointer !== undefined) return;
    e.preventDefault();
    el.classList.add('time-pointer-focus');
    el.focus({ preventScroll: true });
    if (e.target === o.tick) return void o.back(false);
    pointer = e.pointerId;
    rail.setPointerCapture(e.pointerId);
    o.hover(undefined);
    o.press(o.y(e), e.pointerType === 'touch');
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId === pointer) o.drag(o.y(e));
    else if (pointer === undefined && e.pointerType !== 'touch') o.hover(o.y(e));
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    pointer = undefined;
    o.release();
  };
  const leave = (): void => o.hover(undefined);
  const cancel = (): void => {
    const captured = pointer;
    pointer = undefined;
    if (captured !== undefined && rail.hasPointerCapture(captured))
      rail.releasePointerCapture(captured);
    o.release();
  };
  const key = (e: KeyboardEvent): void => {
    clearPointerFocus();
    if (!o.usable() || popoverOpen() || typing(e) || e.defaultPrevented || e.altKey || e.metaKey)
      return;
    const done =
      e.key === 'Home' || e.key === 'End'
        ? o.jump(ends(e.key === 'Home'))
        : pressed(e, 'timeNewer')
          ? o.jump(step(-1))
          : pressed(e, 'timeOlder')
            ? o.jump(step(1))
            : pressed(e, 'timeBack') && o.back(true);
    if (done) e.preventDefault();
  };
  rail.addEventListener('pointerdown', down);
  rail.addEventListener('pointermove', move);
  rail.addEventListener('pointerup', up);
  rail.addEventListener('pointercancel', up);
  rail.addEventListener('lostpointercapture', up);
  rail.addEventListener('pointerleave', leave);
  el.addEventListener('blur', clearPointerFocus);
  window.addEventListener('blur', cancel);
  // Capture runs before the list's own Home (to its head) and the note keys.
  window.addEventListener('keydown', key, true);
  const dispose = (): void => {
    window.removeEventListener('blur', cancel);
    window.removeEventListener('keydown', key, true);
    el.removeEventListener('blur', clearPointerFocus);
    clearPointerFocus();
    for (const [type, fn] of [
      ['pointerdown', down],
      ['pointermove', move],
      ['pointerup', up],
      ['pointercancel', up],
      ['lostpointercapture', up],
      ['pointerleave', leave],
    ] as const)
      rail.removeEventListener(type, fn as EventListener);
  };
  return { cancel, dispose };
}
