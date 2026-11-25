// The events band: the last 32 decisions, newest on top, in words from the string table by `kind`.
// The engine's `summary` is English diagnostic text and is never drawn. While the reader has scrolled down,
// new lines wait behind a count, like the new-notes pill.
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import {
  NONE,
  num,
  type OrchEvent,
  type OrchStats,
  put,
  relayWord,
  viewWord,
} from './orch-model.ts';

const key = (e: OrchEvent): string => `${e.atMs}:${e.kind}:${e.relay ?? ''}:${e.viewSubId ?? ''}`;

export function createEvents() {
  const list = h('ol', { class: 'oevents' });
  const pill = h('button', {
    class: 'opill',
    hidden: true,
    onclick: () => ((list.scrollTop = 0), release()),
  });
  const node = h(
    'section',
    { class: 'oband oevband', 'aria-label': t('orch.events') },
    h('div', { class: 'ohead' }, t('orch.events'), pill),
    list,
  );
  let held: { s: OrchStats; when: (ms: number) => string; safe: boolean } | undefined;
  let shown = new Set<string>(); // bound: the 32 events last drawn
  let drawnSafe = true;
  const release = (): void => {
    if (held) paint(held.s, held.when, held.safe);
  };
  list.addEventListener('scroll', () => void (list.scrollTop <= 0 && release()));
  const line = (
    e: OrchEvent,
    s: OrchStats,
    when: (ms: number) => string,
    safe: boolean,
  ): HTMLElement => {
    const words =
      e.count !== undefined || !['coalesce', 'evict'].includes(e.kind)
        ? t(`orch.ev.${e.kind}` as Key, { n: num(e.count ?? 0) })
        : t(e.kind === 'evict' ? 'orch.evictions' : 'orch.ev.shared');
    const view = e.viewSubId ? s.views?.find((v) => v.subId === e.viewSubId) : undefined;
    return h(
      'li',
      { class: `oev k-${e.kind}` },
      h('span', { class: 'otime' }, when(e.atMs)),
      h('span', { class: 'okind' }, words),
      h('span', { class: 'olbl' }, relayWord(e.relay, s.relays, safe)),
      h('span', { class: 'oview' }, view ? viewWord(view, when) : ''),
      h('span', { class: 'onum' }, e.delayMs === undefined ? '' : `${num(e.delayMs)} ms`),
    );
  };
  const paint = (s: OrchStats, when: (ms: number) => string, safe: boolean): void => {
    const events = [...(s.orchestrationEvents ?? [])].slice(-32).reverse();
    shown = new Set(events.map(key));
    drawnSafe = safe;
    held = undefined;
    pill.hidden = true;
    list.replaceChildren(...events.map((e) => line(e, s, when, safe)));
  };
  return {
    node,
    draw(s: OrchStats, when: (ms: number) => string, safe: boolean): void {
      node.hidden = !s.orchestrationEvents;
      const events = s.orchestrationEvents ?? [];
      // Turning Stage-safe on repaints at once, even with lines held back.
      if (list.scrollTop > 0 && safe === drawnSafe) {
        const fresh = events.filter((e) => !shown.has(key(e))).length;
        held = { s, when, safe };
        pill.hidden = !fresh;
        put(pill, t('orch.eventsNew', { n: num(fresh) }));
        return;
      }
      paint(s, when, safe);
    },
  };
}
