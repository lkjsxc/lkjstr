// The Orchestration tab: how the engine spends the link, live, from the shared `stats` poll (one second, only
// while the tab is in front and the page is shown). Bands the engine does not report are left out.
// Stage-safe (on for a new tab) and Large are saved with the tab; Pause freezes the picture, not the engine.
import { clockOf, dayOf, fullTime } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { createEvents } from './orch-events.ts';
import { createFigures, type Modes } from './orch-figures.ts';
import { createFlow } from './orch-flow.ts';
import { createLink } from './orch-link.ts';
import { NONE, type OrchStats, put } from './orch-model.ts';
import { createOptimizer } from './orch-optimizer.ts';
import { createWindows } from './orch-windows.ts';
import { createWorker } from './orch-worker.ts';
import type { ViewEnv } from './registry.ts';
import { watchStats } from './stats-poll.ts';

type Saved = { stageSafe: boolean; large: boolean };

/** A content time (a note's, a Moment's): `HH:mm` today, otherwise with its day. */
export function stampOf(ms: number, now = Date.now()): string {
  return dayOf(ms) === dayOf(now) ? clockOf(ms) : `${dayOf(ms)} ${clockOf(ms)}`;
}
/** An engine clock time, placed on the page's clock by `nowMs`; an unplaceable one is a dash. */
export function engineClock(s: OrchStats, now = Date.now()): (ms: number) => string {
  return (ms) => {
    const wall = s.nowMs !== undefined ? now - (s.nowMs - ms) : ms > 1e12 ? ms : undefined;
    return wall === undefined ? NONE : fullTime(wall).slice(11);
  };
}

export function mountOrchestration(el: HTMLElement, env: ViewEnv): () => void {
  const saved = loadViewState<Saved>(env.instance);
  const modes: Modes = {
    safe: saved.stageSafe !== false,
    large: saved.large === true,
    paused: false,
  };
  let last: OrchStats | undefined;
  let frozenAt: string | undefined;
  const figures = createFigures(modes, (chip) => {
    modes[chip] = !modes[chip];
    if (chip === 'paused') frozenAt = modes.paused ? fullTime(Date.now()).slice(11) : undefined;
    else
      saveViewState(env.instance, {
        ...loadViewState(env.instance),
        stageSafe: modes.safe,
        large: modes.large,
      });
    paintModes();
    // A mode change redraws what is on screen even while paused: turning Stage-safe on never waits for a frame.
    if (last) draw(last, true);
  });
  const flow = createFlow();
  const windows = createWindows();
  const worker = createWorker();
  const link = createLink();
  const optimizer = createOptimizer();
  const events = createEvents();
  const state = h('div', { class: 'fstate muted' }, t('feed.loading'));
  const bands = h(
    'div',
    { class: 'obands', hidden: true },
    flow.node,
    windows.node,
    worker.node,
    link.node,
    optimizer.node,
    events.node,
  );
  const paintModes = (): void => {
    el.classList.toggle('large', modes.large);
    el.classList.toggle('paused', modes.paused);
    figures.modes(modes, frozenAt);
  };
  function draw(s: OrchStats, force = false): void {
    last = s;
    if (modes.paused && !force) return;
    state.hidden = true;
    bands.hidden = false;
    el.classList.remove('off');
    const clock = engineClock(s);
    const stamp = (ms: number): string => stampOf(ms);
    figures.draw(s);
    flow.draw(s, { safe: modes.safe, when: stamp });
    windows.draw(s, stamp);
    worker.draw(s);
    link.draw(s);
    optimizer.draw(s, clock);
    events.draw(s, clock, modes.safe);
  }
  const watch = watchStats(env.engine, (s) => {
    if (s) return draw(s as OrchStats);
    if (modes.paused) return;
    // No answer: what is on screen is no longer current, and is not left standing as if it were.
    bands.hidden = true;
    state.hidden = false;
    put(state, t('stats.none'));
    el.classList.add('off');
  });
  el.classList.add('pad', 'orchv');
  el.tabIndex = -1;
  el.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey) return;
    const at = e.target as HTMLElement;
    if (at !== el && at.closest('button, input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    e.stopPropagation();
    (figures.node.querySelector('[data-chip="paused"]') as HTMLButtonElement).click();
  });
  el.replaceChildren(figures.node, state, bands);
  paintModes();
  env.menu(() => [{ label: t('view.stats'), run: () => env.open('stats') }]);
  const off = env.visible.subscribe((on) => watch.show(on));
  watch.show(env.visible.get());
  return () => {
    off();
    watch.dispose();
  };
}
