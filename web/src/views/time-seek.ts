// Jumps on the time rail (docs/interface-time.md C3). A loaded target scrolls at once; any other asks the engine for a
// window around it. One seek is out at a time: a newer target waits for its answer and is sent next, at most once per
// 80ms, so an answer that arrives late never pulls the list back to an earlier target. Every jump leaves one return
// tick at the place it started; returning goes to the exact row and offset.
import type { Anchor, Timeline } from '../engine/protocol.ts';
import type { Place } from './feed-place.ts';
import type { TimePlace } from './time-scale.ts';

const SEEK_MS = 80;

export type Back = { place: Place; time: TimePlace };
export type Seeker = ReturnType<typeof createSeeker>;

export function createSeeker(o: {
  /** Scrolls to a loaded note (to `saved`, a row and offset, when given); false when it is not drawn. */
  scrollTo(p: TimePlace, saved?: Place): boolean;
  seek(anchor: Anchor): void;
  /** The reading place now. */
  current(): Back | undefined;
  /** A seek went out. */
  sent(): void;
  /** A jump arrived where it was going. */
  landed(): void;
  sync(): void;
}) {
  const s = {
    /** Asked of the engine, not yet drawn. */
    pending: undefined as TimePlace | undefined,
    /** The latest target, while a seek is out. */
    waiting: undefined as TimePlace | undefined,
    inflight: false,
    back: undefined as Back | undefined,
    returning: false,
    /** Where a held press started. */
    origin: undefined as Back | undefined,
  };
  let sent = Number.NEGATIVE_INFINITY;
  let windowVersion = 0;
  let timelineVersion = 0;
  let pendingVersion = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued: TimePlace | undefined;
  const send = (p: TimePlace, anchor: Anchor): void => {
    s.pending = p;
    s.inflight = true;
    sent = performance.now();
    pendingVersion = windowVersion;
    o.sent();
    o.seek(anchor);
  };
  const go = (p: TimePlace): void => {
    if (!s.returning) s.back = s.origin ?? o.current();
    if (s.inflight) return void ((s.waiting = p), o.sync());
    if (o.scrollTo(p)) (s.pending = undefined), o.landed();
    else send(p, { ...p, returnKey: s.back?.place.key });
    o.sync();
  };
  const flush = (): void => {
    clearTimeout(timer);
    timer = undefined;
    const p = queued;
    queued = undefined;
    if (p) go(p);
  };
  const queue = (p: TimePlace, wait = SEEK_MS): void => {
    queued = p;
    timer ??= setTimeout(flush, Math.max(0, wait));
  };
  return {
    s,
    go,
    flush,
    queue,
    /** To the return tick, if there is one. */
    ret(): boolean {
      const back = s.back;
      if (!back) return false;
      s.returning = true;
      if (o.scrollTo(back.time, back.place))
        (s.back = undefined), (s.returning = false), o.landed();
      else if (!s.inflight) send(back.time, { key: back.place.key });
      o.sync();
      return true;
    },
    /** On every paint: land a jump whose window is drawn, then send the target that waited for it. */
    settle(data: Timeline | undefined): void {
      const applied = timelineVersion > pendingVersion;
      if (s.pending) {
        const requested = applied && data?.positions.find((p) => p.key === data?.anchor);
        // Evicted meanwhile: the window's anchor is the nearest row, and that is where it lands.
        const target =
          requested || (applied && data?.anchor ? data.positions[0] : undefined) || s.pending;
        if (o.scrollTo(target, s.returning ? s.back?.place : undefined)) {
          s.pending = undefined;
          if (s.returning) (s.back = undefined), (s.returning = false);
          if (!s.waiting) o.landed();
        }
      }
      if (s.inflight && applied) {
        s.inflight = false;
        // A target the drag queued since is newer than the one that waited: it goes instead.
        if (s.waiting) queue(queued ?? s.waiting, sent + SEEK_MS - performance.now());
        s.waiting = undefined;
      }
    },
    window(): void {
      windowVersion++;
    },
    timeline(next: Timeline): void {
      timelineVersion = windowVersion;
      const returned = s.back && next.positions.find((p) => p.key === s.back?.place.key);
      if (s.back && returned) s.back = { ...s.back, time: returned };
    },
    stop(): void {
      clearTimeout(timer);
      timer = queued = s.waiting = s.pending = undefined;
      s.inflight = false;
    },
  };
}
