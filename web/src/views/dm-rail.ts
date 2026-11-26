// Pure time-rail index for already-projected private DM lists (messages inbox and message timeline).
// Private bodies never enter public caches; this maps only the current view's (key, at) rows.
import type { Timeline } from '../engine/protocol.ts';
import { localDay, localZone } from '../shared/format.ts';
import type { Keeper, Place } from './feed-place.ts';

export type DmRailRow = { readonly kind: 'dm'; readonly key: string; readonly at: number };

const MAX_DAYS = 400;

/** Builds a newest-first Timeline from already-projected DM rows, matching the engine's month/day rules. */
export function dmTimeline(
  items: readonly DmRailRow[],
  older: boolean,
  now = Date.now(),
): Timeline {
  const months = new Map<number, number>();
  const positions: { key: string; month: number; offset: number; at: number }[] = [];
  const days: { at: number; month: number; offset: number; count: number }[] = [];
  let occupied = 0;
  let previous = Number.POSITIVE_INFINITY;
  let newest = 0;
  let oldest = 0;
  for (const item of items) {
    const at = Math.min(item.at, now, previous);
    if (previous === Number.POSITIVE_INFINITY) newest = item.at;
    oldest = item.at;
    previous = at;
    const date = new Date(at);
    const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
    const offset = months.get(month) ?? 0;
    months.set(month, offset + 1);
    positions.push({ key: item.key, month, offset, at: item.at });
    if (occupied <= MAX_DAYS) {
      const day = localDay(at);
      const part = days.at(-1);
      if (part?.at === day && part.month === month) part.count++;
      else {
        if (part?.at !== day) occupied++;
        if (occupied <= MAX_DAYS) days.push({ at: day, month, offset, count: 1 });
      }
    }
  }
  return {
    supported: true,
    newest,
    oldest,
    months: [...months].map(([at, count]) => ({ at, count })),
    positions,
    older,
    zone: localZone(),
    ...(occupied <= MAX_DAYS ? { days } : {}),
  };
}

/** Minimal Keeper for flat DOM lists (DM inbox) where all rows are mounted directly in `list`. */
export function createListKeeper(el: HTMLElement, list: HTMLElement, tail: HTMLElement): Keeper {
  let place: Place | undefined;
  return {
    get: () => place,
    set(next) {
      place = next;
      const node = [...list.children].find((n) => (n as HTMLElement).dataset.key === next.key) as
        | HTMLElement
        | undefined;
      if (!node) return;
      const delta = node.getBoundingClientRect().top - el.getBoundingClientRect().top - next.off;
      if (el.scrollTop + delta > el.scrollHeight - el.clientHeight) {
        const bottom = tail.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
        const deficit = Math.ceil(el.clientHeight + delta - bottom);
        tail.style.height = `${tail.offsetHeight + Math.max(0, deficit)}px`;
      }
      el.scrollTop += delta;
    },
    read: () => undefined,
    put: () => true,
    hold: () => () => undefined,
    forget: () => void ((place = undefined), (tail.style.height = ''), (el.scrollTop = 0)),
    dispose: () => undefined,
  };
}
