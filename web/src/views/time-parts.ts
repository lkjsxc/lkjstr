// Calendar counts for the already-projected rows of a provisional rail, a DM list or the mock.
import type { Timeline } from '../engine/protocol.ts';
import { localDay } from '../shared/format.ts';

export type Day = NonNullable<Timeline['days']>[number];
export type ClockPart = NonNullable<Timeline['clock']>[number];

const MAX_DAYS = 400;
const MAX_CLOCK = 4096;

export function createTimeParts() {
  const days: Day[] = [];
  const groups: { notes: number; parts: ClockPart[] }[] = [];
  let overflow = false;
  return {
    count(at: number, month: number, offset: number) {
      if (overflow) return;
      const previous = days.at(-1);
      const day = previous && at >= previous.at ? previous.at : localDay(at);
      if (previous?.at !== day) {
        if (groups.length === MAX_DAYS) {
          overflow = true;
          return;
        }
        groups.push({ notes: 0, parts: [] });
      }
      if (previous?.at === day && previous.month === month)
        days[days.length - 1] = { ...previous, count: previous.count + 1 };
      else days.push({ at: day, month, offset, count: 1 });
      const group = groups.at(-1)!;
      group.notes++;
      const parts = group.parts;
      const last = parts.at(-1);
      if (last && at >= last[0] && last[1] === month) {
        parts[parts.length - 1] = [last[0], month, last[2], last[3] + 1];
        return;
      }
      const d = new Date(at);
      const elapsed = ((d.getMinutes() % 5) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
      parts.push([Math.max(0, at - elapsed), month, offset, 1]);
    },
    fields() {
      const include = new Set<(typeof groups)[number]>();
      let room = MAX_CLOCK;
      for (const group of [...groups].sort((a, b) => b.notes - a.notes)) {
        if (group.parts.length > room) continue;
        room -= group.parts.length;
        include.add(group);
      }
      return { days, clock: groups.filter((g) => include.has(g)).flatMap((g) => g.parts) };
    },
  };
}
