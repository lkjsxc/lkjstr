// Additional orchestration columns use the existing Stats table pattern.
import type { EngineStats } from '../engine/protocol.ts';
import { hostOf } from '../shared/address.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';

type Relay = EngineStats['relays'][number];
export type RoutingKey = 'readRule' | 'followedCovered' | 'weight';
const rank = { reader: 0, search: 1, hint: 2, unused: 3 };
const marks = { reader: '●', search: '⌕', hint: '↗', unused: '—' };
export const ROUTING = ['readRule', 'followedCovered', 'weight'] as const;
export const routingValue = (key: RoutingKey, r: Relay): number | null =>
  key === 'readRule' ? (r.readRule ? rank[r.readRule] : null) : (r[key] ?? null);
export function routingCells() {
  const cells = ROUTING.map((key) => ({ key, el: h('td', { class: `c-${key}` }) }));
  return {
    nodes: cells.map((c) => c.el),
    update(r: Relay) {
      for (const { key, el } of cells) {
        const text =
          key === 'readRule' ? (r.readRule ? marks[r.readRule] : '—') : String(r[key] ?? '—');
        if (el.textContent !== text) el.textContent = text;
        if (key === 'readRule') el.title = r.readRule ? t(`stats.rule.${r.readRule}`) : '';
        el.classList.toggle('nil', !routingValue(key, r));
      }
    },
  };
}
type Request = NonNullable<EngineStats['requests']>[number];
export function requestTable() {
  let rows: readonly Request[] = [];
  type SortKey = 'id' | 'relay' | 'priority' | 'weight' | 'received';
  let by: SortKey = 'priority';
  let ascending = true;
  const body = h('tbody');
  const cols: readonly (readonly [SortKey, Key])[] = [
    ['id', 'stats.request'],
    ['relay', 'stats.relay'],
    ['priority', 'stats.purpose'],
    ['weight', 'stats.weight'],
    ['received', 'stats.events'],
  ];
  const heads = cols.map(([key, label]) =>
    h(
      'th',
      { scope: 'col' },
      h(
        'button',
        {
          onclick: () => {
            ascending = by === key ? !ascending : true;
            by = key;
            draw();
          },
        },
        t(label),
      ),
    ),
  );
  const table = h(
    'table',
    { class: 'stab', hidden: true },
    h('thead', null, h('tr', null, ...heads)),
    body,
  );
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
    body.replaceChildren(
      ...sorted.map((r) =>
        h(
          'tr',
          null,
          h('td', null, `${r.id} / ${r.wireId}`, r.complete ? ' ✓' : r.sent ? ' ·' : ''),
          h('td', { title: r.relay }, hostOf(r.relay)),
          h('td', null, t(`stats.purpose.${r.purpose}`)),
          h('td', null, String(r.weight)),
          h('td', null, String(r.received)),
        ),
      ),
    );
  }
  return {
    node: h('div', { style: 'overflow-x:auto' }, table),
    update(s: EngineStats) {
      rows = s.requests ?? [];
      draw();
    },
  };
}
