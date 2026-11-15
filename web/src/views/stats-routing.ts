// Additional orchestration columns use the existing Stats table pattern.
import type { EngineStats } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { createStatsDetails, relayName } from './stats-details.ts';

type Relay = EngineStats['relays'][number];
export type RoutingKey = 'readRule' | 'followedCovered' | 'weight';
const rank = { reader: 0, search: 1, hint: 2, unused: 3 };
const routeRank = { both: 0, reading: 1, writing: 2, search: 3, own: 4, unused: 5 };
export const ROUTING = ['readRule', 'followedCovered', 'weight'] as const;
export const routingValue = (key: RoutingKey, r: Relay): number | null =>
  key === 'readRule'
    ? r.route
      ? routeRank[r.route]
      : r.readRule
        ? rank[r.readRule]
        : null
    : (r[key] ?? null);
export function routingCells() {
  const cells = ROUTING.map((key) => ({ key, el: h('td', { class: `c-${key}` }) }));
  return {
    nodes: cells.map((c) => c.el),
    update(r: Relay) {
      const never = r.connectedSince === null && !r.eventsReceived && !r.bytesIn && !r.bytesOut;
      for (const { key, el } of cells) {
        const text = never
          ? '—'
          : key === 'readRule'
            ? r.route
              ? t(`stats.route.${r.route}`)
              : r.readRule
                ? t(`stats.rule.${r.readRule}`)
                : '—'
            : r[key]
              ? String(r[key])
              : '—';
        if (el.textContent !== text) el.textContent = text;
        el.classList.toggle('nil', text === '—');
      }
    },
  };
}
type Request = NonNullable<EngineStats['requests']>[number];
export function requestTable(instance: string) {
  let rows: readonly Request[] = [];
  type SortKey = 'id' | 'relay' | 'priority' | 'weight' | 'received';
  const saved = loadViewState<{ requestBy: SortKey; requestAscending: boolean }>(instance);
  const cols: readonly (readonly [SortKey, Key])[] = [
    ['priority', 'stats.purpose'],
    ['relay', 'stats.relay'],
    ['id', 'stats.request'],
    ['weight', 'stats.weight'],
    ['received', 'stats.events'],
  ];
  let by: SortKey = cols.some(([key]) => key === saved.requestBy) ? saved.requestBy! : 'priority';
  let ascending = saved.requestAscending !== false;
  const disclosure = createStatsDetails(instance, 'requestOpen');
  const body = h('tbody');
  const heads = cols.map(([key, label]) =>
    h(
      'th',
      { class: `c-${key}`, scope: 'col' },
      h(
        'button',
        {
          onclick: () => {
            ascending = by === key ? !ascending : true;
            by = key;
            saveViewState(instance, {
              ...loadViewState(instance),
              requestBy: by,
              requestAscending: ascending,
            });
            draw();
          },
        },
        t(label),
      ),
    ),
  );
  const table = h(
    'table',
    { class: 'stab request-stats', hidden: true },
    h('thead', null, h('tr', null, ...heads)),
    body,
  );
  const lines = new Map<string, { row: HTMLElement; detail: HTMLElement; update(): void }>();
  function draw() {
    table.hidden = rows.length === 0;
    heads.forEach((th, i) =>
      th.setAttribute(
        'aria-sort',
        cols[i]?.[0] === by ? (ascending ? 'ascending' : 'descending') : 'none',
      ),
    );
    const sorted = [...rows].sort((a, b) => {
      const x = a[by],
        y = b[by];
      const d =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return (ascending ? d : -d) || a.id.localeCompare(b.id);
    });
    const want = sorted.flatMap((r) => {
      const id = `${r.relay}:${r.id}`;
      let line = lines.get(id);
      if (!line) {
        const row = h('tr', null, ...cols.map(([key]) => h('td', { class: `c-${key}` })));
        const details = disclosure.add(
          id,
          row,
          cols.filter(([key]) => !['priority', 'relay'].includes(key)),
        );
        line = { row, detail: details.detail, update: details.update };
        lines.set(id, line);
      }
      const values = [
        t(`stats.purpose.${r.purpose}`),
        relayName(r.relay),
        `${r.id} / ${r.wireId}${r.complete ? ' ✓' : r.sent ? ' ·' : ''}`,
        String(r.weight),
        String(r.received),
      ];
      cols.forEach(([key], i) => {
        const cell = line!.row.querySelector<HTMLElement>(`.c-${key}`)!;
        const value = values[i]!;
        if (typeof value === 'string') cell.textContent = value;
        else cell.replaceChildren(value);
      });
      line.update();
      return [line.row, line.detail];
    });
    for (const [id, line] of lines)
      if (!want.includes(line.row)) {
        line.row.remove();
        line.detail.remove();
        lines.delete(id);
        disclosure.remove(id);
      }
    want.forEach((row, i) => {
      if (body.children[i] !== row) body.insertBefore(row, body.children[i] ?? null);
    });
  }
  return {
    node: h('div', { class: 'stats-table' }, table),
    update(s: EngineStats) {
      rows = s.requests ?? [];
      draw();
    },
  };
}
