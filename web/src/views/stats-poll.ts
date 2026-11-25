// One `stats` poll per engine client, shared by every Stats and Orchestration tab that is in front.
// It runs only while at least one of them is visible and the page is shown; otherwise no request is sent.
import type { EngineStats } from '../engine/protocol.ts';

type Engine = { stats(): Promise<EngineStats | undefined> };
type Listener = (s: EngineStats | undefined) => void;
export type StatsWatch = {
  /** In front (true) or not; only watches in front keep the poll running. */
  show(on: boolean): void;
  dispose(): void;
};
type Poll = { watch(fn: Listener): StatsWatch };

export const STATS_EVERY_MS = 1000;
// Bound: one entry per engine client; the key is weak, so a disposed engine takes its poll along.
const polls = new WeakMap<Engine, Poll>();

function createPoll(engine: Engine): Poll {
  const shown = new Set<Listener>(); // bound: the mounted Stats and Orchestration tabs
  let timer: ReturnType<typeof setInterval> | undefined;
  let asking = false;
  const ask = async (): Promise<void> => {
    if (asking || !shown.size) return;
    asking = true;
    let s: EngineStats | undefined;
    try {
      s = await engine.stats();
    } catch {
      s = undefined;
    }
    asking = false;
    for (const fn of [...shown]) fn(s);
  };
  const pageShown = (): boolean =>
    typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const run = (): void => {
    const want = shown.size > 0 && pageShown();
    if (want && timer === undefined) {
      void ask();
      timer = setInterval(() => void ask(), STATS_EVERY_MS);
    } else if (!want && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
  const onPage = (): void => run();
  return {
    watch(fn) {
      const show = (on: boolean): void => {
        const had = shown.has(fn);
        if (on) shown.add(fn);
        else shown.delete(fn);
        if (shown.size === 1 && !had && on) document.addEventListener('visibilitychange', onPage);
        if (!shown.size) document.removeEventListener('visibilitychange', onPage);
        // A tab coming to the front while the poll already runs is answered at once, not a second later.
        if (on && !had && timer !== undefined) void ask();
        run();
      };
      return { show, dispose: () => show(false) };
    },
  };
}

export function watchStats(engine: Engine, fn: Listener): StatsWatch {
  let poll = polls.get(engine);
  if (!poll) polls.set(engine, (poll = createPoll(engine)));
  return poll.watch(fn);
}
