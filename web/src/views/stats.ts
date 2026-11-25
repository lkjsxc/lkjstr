import type { EngineStats } from '../engine/protocol.ts';
import { clockOf, dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import type { ViewEnv } from './registry.ts';
import { COLUMNS, PUBLISH, PUBLISH_KEYS, type SortKey } from './stats-columns.ts';
import { compoundTitle, createStatsDetails, relayName } from './stats-details.ts';
import { watchStats } from './stats-poll.ts';
import { requestTable, routingCells, routingValue } from './stats-routing.ts';

type Relay = EngineStats['relays'][number];
export type Mark = 'failing' | 'silent' | 'slow';
type Sort = { by: SortKey; up: boolean };
const SLOW_MS = 1000;
const NONE = '—';

export function relayMark(r: Relay): Mark | undefined {
  if (r.state === 'failed' || r.state === 'waiting') return 'failing';
  if (r.state !== 'connected') return undefined;
  if (r.openSubscriptions > 0 && r.eventsReceived === 0) return 'silent';
  return r.latencyMs !== null && r.latencyMs >= SLOW_MS ? 'slow' : undefined;
}
const num = (n: number): string => n.toLocaleString(getLang() === 'ja' ? 'ja-JP' : 'en-US');
export function bytesText(n: number): string {
  const units = ['B', 'kB', 'MB', 'GB'];
  let v = n;
  let u = 0;
  while (v >= 1000 && u < units.length - 1) (v /= 1000), u++;
  return `${u === 0 || v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${units[u]}`;
}
const RANK: Record<Mark, number> = { failing: 0, silent: 1, slow: 2 };
const VALUE: Record<SortKey, (r: Relay) => number | null> = {
  readRule: (r) => routingValue('readRule', r),
  followedCovered: (r) => routingValue('followedCovered', r),
  weight: (r) => routingValue('weight', r),
  health: (r) => -(RANK[relayMark(r) ?? 'slow'] + (relayMark(r) ? 0 : 1)),
  events: (r) => r.eventsReceived,
  dup: (r) => r.duplicatesDropped,
  latency: (r) => r.latencyMs,
  subs: (r) => r.openSubscriptions,
  data: (r) => r.bytesIn + r.bytesOut,
  publishAccepted: (r) => r.publishAccepted ?? null,
  publishOwnSkipped: (r) => r.publishOwnSkipped ?? null,
  publishPending: (r) => r.publishPending ?? null,
};
export function sortRelays(relays: readonly Relay[], sort: Sort): Relay[] {
  const value = VALUE[sort.by];
  return [...relays].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    if (x === null || y === null) return x === y ? a.url.localeCompare(b.url) : x === null ? 1 : -1;
    const d = sort.up ? x - y : y - x;
    return d || b.eventsReceived - a.eventsReceived || a.url.localeCompare(b.url);
  });
}

const put = (el: HTMLElement, text: string): void => {
  if (el.textContent !== text) el.textContent = text;
};
const tally = (el: HTMLElement, n: number): void => {
  put(el, num(n));
  el.classList.toggle('nil', n === 0);
};

export function mountStats(el: HTMLElement, env: ViewEnv): () => void {
  const disclosure = createStatsDetails(env.instance, 'relayOpen');
  const saved = loadViewState<Sort>(env.instance);
  const sort: Sort = {
    by: COLUMNS.some(([k]) => k === saved.by) ? (saved.by as SortKey) : 'health',
    up: saved.up === true,
  };
  let last: EngineStats | undefined;
  const figure = (label: Key, extra?: HTMLElement) => {
    const val = h('div', { class: 'sval' }, NONE);
    const sub = h('div', { class: 'ssub muted' });
    const node = h(
      'div',
      { class: 'sfig' },
      h('div', { class: 'slabel' }, t(label)),
      val,
      extra,
      sub,
    );
    return { node, val, sub };
  };
  const share = h('span');
  const figs = {
    up: figure('stats.connected'),
    cover: figure('stats.covering'),
    cache: figure('stats.cache', h('div', { class: 'sbar', 'aria-hidden': 'true' }, share)),
    saved: figure('stats.dropped'),
    stored: figure('stats.stored'),
  };
  const state = h('div', { class: 'fstate muted' }, t('feed.loading'));
  const heads = COLUMNS.map(([key, label]) => {
    const th = h(
      'th',
      { class: `c-${key}`, scope: 'col', title: compoundTitle(key) },
      h(
        'button',
        {
          title: compoundTitle(key),
          onclick: () => {
            sort.up = sort.by === key ? !sort.up : false;
            sort.by = key;
            saveViewState(env.instance, { ...loadViewState(env.instance), ...sort });
            if (last) draw(last);
          },
        },
        t(label),
      ),
    );
    return { key, th };
  });
  const since = h('th', { class: 'c-since', scope: 'col' }, t('stats.since'));
  const requests = requestTable(env.instance);
  const body = h('tbody');
  const table = h(
    'table',
    { class: 'stab relay-stats', hidden: true },
    h('thead', null, h('tr', null, ...heads.map((x) => x.th), since)),
    body,
  );
  type Line = { tr: HTMLElement; detail: HTMLElement; set(r: Relay, most: number): void };
  const lines = new Map<string, Line>(); // bound: the relays the engine reports
  const line = (url: string): Line => {
    const cell = (key: string, ...kids: HTMLElement[]): HTMLElement =>
      h('td', { class: `c-${key}`, title: compoundTitle(key) }, ...kids);
    const mark = h('span', { class: 'smark' });
    const error = h('div', { class: 'rsub muted' });
    const bar = h('span');
    const [events, dup, latency, subs, data, at] = Array.from({ length: 6 }, () => h('span'));
    const routing = routingCells();
    const publishing = PUBLISH_KEYS.map((key) => ({ key, value: h('span') }));
    const tr = h(
      'tr',
      null,
      h(
        'td',
        { class: 'c-health' },
        h(
          'div',
          { class: 'shost' },
          h('span', { class: 'rdot', 'aria-hidden': 'true' }),
          relayName(url),
          mark,
        ),
        error,
      ),
      ...routing.nodes,
      cell(
        'events',
        events as HTMLElement,
        h('div', { class: 'sbar', 'aria-hidden': 'true' }, bar),
      ),
      cell('dup', dup as HTMLElement),
      cell('latency', latency as HTMLElement),
      cell('subs', subs as HTMLElement),
      cell('data', data as HTMLElement),
      ...publishing.map(({ key, value }) => cell(key, value)),
      cell('since', at as HTMLElement),
    );
    const details = disclosure.add(url, tr, [
      ...COLUMNS.filter(([key]) => !['health', 'events', 'latency'].includes(key)),
      ['since', 'stats.since'],
    ]);
    const set = (r: Relay, most: number): void => {
      const never = r.connectedSince === null && !r.eventsReceived && !r.bytesIn && !r.bytesOut;
      routing.update(r);
      const m = relayMark(r);
      const cls = `stats-toggle s-${r.state}${m ? ` m-${m}` : ''}`;
      if (tr.className !== cls) tr.className = cls;
      put(mark, m ? t(`stats.${m}`) : '');
      put(error, r.lastError === 'capacity' ? t('stats.capacity') : (r.lastError ?? ''));
      tally(events as HTMLElement, r.eventsReceived);
      if (never) put(events as HTMLElement, NONE);
      bar.parentElement!.hidden = !r.eventsReceived;
      bar.style.width = `${most ? Math.round((r.eventsReceived / most) * 100) : 0}%`;
      tally(dup as HTMLElement, r.duplicatesDropped);
      if (never) put(dup as HTMLElement, NONE);
      put(latency as HTMLElement, never || r.latencyMs === null ? NONE : `${num(r.latencyMs)} ms`);
      tally(subs as HTMLElement, r.openSubscriptions);
      if (never) put(subs as HTMLElement, NONE);
      put(
        data as HTMLElement,
        never || (!r.bytesIn && !r.bytesOut)
          ? NONE
          : `↓ ${bytesText(r.bytesIn)}  ↑ ${bytesText(r.bytesOut)}`,
      );
      (data as HTMLElement).classList.toggle('nil', r.bytesIn + r.bytesOut === 0);
      for (const { key, value } of publishing) {
        const counts = PUBLISH[key].map((field) => r[field]);
        put(
          value,
          counts.every((n) => !n)
            ? NONE
            : counts.map((n) => (n === undefined ? NONE : num(n))).join(' / '),
        );
        value.classList.toggle(
          'nil',
          counts.every((n) => !n),
        );
      }
      const c = r.connectedSince;
      const day = c !== null && dayOf(c) !== dayOf(Date.now()) ? `${dayOf(c)} ` : '';
      put(at as HTMLElement, c === null ? NONE : `${day}${clockOf(c)}`);
      details.update();
    };
    return { tr, detail: details.detail, set };
  };

  function draw(s: EngineStats): void {
    last = s;
    requests.update(s);
    state.hidden = true;
    table.hidden = false;
    const marks = s.relays.map(relayMark);
    const count = (m: Mark): number => marks.filter((x) => x === m).length;
    const online = s.relays.filter((r) => r.state === 'connected').length;
    put(figs.up.val, `${num(online)}/${num(s.relays.length)}`);
    put(
      figs.up.sub,
      (['failing', 'silent', 'slow'] as const)
        .filter((m) => count(m))
        .map((m) => `${t(`stats.${m}`)} ${count(m)}`)
        .join(' · '),
    );
    figs.up.node.classList.toggle('bad', count('failing') > 0);
    put(figs.cover.val, num(s.orchestration.relaysCoveringFollowSet));
    put(figs.cover.sub, t('stats.subsOpen', { n: num(s.totals.subscriptions) }));
    const { servedFromCache: cached, servedFromNetwork: net } = s.totals;
    const part = cached + net ? Math.round((cached / (cached + net)) * 100) : undefined;
    put(figs.cache.val, part === undefined ? NONE : `${part}%`);
    share.style.width = `${part ?? 0}%`;
    put(figs.cache.sub, t('stats.cacheOf', { cache: num(cached), net: num(net) }));
    put(figs.saved.val, num(s.relays.reduce((n, r) => n + r.duplicatesDropped, 0)));
    put(figs.saved.sub, t('stats.coalesced', { n: num(s.orchestration.requestsCoalesced) }));
    put(figs.stored.val, num(s.totals.eventsStored));
    put(figs.stored.sub, bytesText(s.totals.cacheBytes));
    for (const { key, th } of heads)
      th.setAttribute('aria-sort', key !== sort.by ? 'none' : sort.up ? 'ascending' : 'descending');
    const most = Math.max(0, ...s.relays.map((r) => r.eventsReceived));
    const want = sortRelays(s.relays, sort).flatMap((r) => {
      const l = lines.get(r.url) ?? line(r.url);
      lines.set(r.url, l);
      l.set(r, most);
      return [l.tr, l.detail];
    });
    for (const [url, l] of lines)
      if (!want.includes(l.tr))
        l.tr.remove(), l.detail.remove(), lines.delete(url), disclosure.remove(url);
    want.forEach((tr, i) => {
      if (body.children[i] !== tr) body.insertBefore(tr, body.children[i] ?? null);
    });
  }

  const watch = watchStats(env.engine, (s) => {
    if (s) return draw(s);
    // No answer: what is on screen is no longer current, and is not left standing as if it were.
    table.hidden = true;
    state.hidden = false;
    put(state, t('stats.none'));
    el.classList.add('off');
  });
  el.classList.add('pad', 'statsv');
  el.tabIndex = -1;
  el.replaceChildren(
    h('div', { class: 'sfigs' }, ...Object.values(figs).map((f) => f.node)),
    state,
    h('div', { class: 'stats-table' }, table),
    requests.node,
  );
  env.menu(() => [{ label: t('view.relays'), run: () => env.open('relays') }]);
  const off = env.visible.subscribe((on) => watch.show(on));
  watch.show(env.visible.get());
  return () => {
    off();
    watch.dispose();
  };
}
