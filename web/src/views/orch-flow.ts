// The flow band: views (focused first) -> wire envelopes (shared requests) -> relays (primary, hedge).
// A view names the envelopes it joined and an envelope names its relay: the joins are the lines of the diagram,
// drawn as `→ env 3` so they hold at any width.
import { h } from '../shared/h.ts';
import { hasKey, t } from '../shared/i18n.ts';
import {
  NONE,
  num,
  type OrchRelay,
  type OrchRequest,
  type OrchStats,
  type OrchView,
  put,
  relayLines,
  relayWord,
  viewWord,
} from './orch-model.ts';
import { createSteadyOrder, place } from './orch-order.ts';

const PURPOSE = ['focused', 'visible', 'history', 'notifications', 'own', 'hydration', 'prefetch'];
const NEWS_MS = 2000;
type Ctx = { safe: boolean; when: (ms: number) => string };

const column = (title: string, list: HTMLElement, head?: HTMLElement): HTMLElement =>
  h(
    'section',
    { class: `ocol${head ? ' orelays' : ''}`, 'aria-label': title },
    h('div', { class: 'ohead' }, title),
    head,
    list,
  );
const relayHead = (): HTMLElement =>
  h(
    'div',
    { class: 'orow orelay ohrow', 'aria-hidden': 'true' },
    h('span'),
    h('span'),
    h('span', null, t('orch.role')),
    h('span', null, t('orch.firstEvent')),
    h('span', null, t('orch.dupShare')),
    h('span'),
  );
const rowOf = (cls: string, ...kids: HTMLElement[]): HTMLElement =>
  h('div', { class: `orow ${cls}` }, ...kids);
const span = (cls: string): HTMLElement => h('span', { class: cls });

function viewRow() {
  const [label, joins, state, count] = ['olbl', 'ojoin', 'ostate', 'onum'].map(
    span,
  ) as HTMLElement[];
  const el = rowOf('', label!, joins!, state!, count!);
  return {
    el,
    set(v: OrchView, ctx: Ctx, to: string) {
      el.className = `orow${v.focused ? ' focused' : ''}${v.visible ? '' : ' hid'}`;
      put(label!, viewWord(v, ctx.when));
      put(joins!, to);
      put(state!, v.focused ? t('orch.focused') : v.visible ? '' : t('orch.hidden'));
      put(count!, num(v.rowCount));
    },
  };
}
function relayRow() {
  const [dot, label, role, first, dup, cool] = [
    'rdot',
    'olbl',
    'orole',
    'onum',
    'onum',
    'ocool',
  ].map(span) as HTMLElement[];
  const el = rowOf('orelay', dot!, label!, role!, first!, dup!, cool!);
  return {
    el,
    set(label_: string, rs: readonly OrchRelay[], roleWord: string, news: boolean) {
      const up = rs.some((r) => r.state === 'connected');
      const trying = rs.some((r) => r.state === 'connecting' || r.state === 'waiting');
      el.className = `orow orelay s-${up ? 'connected' : trying ? 'connecting' : (rs[0]?.state ?? 'idle')}${news ? ' news' : ''}`;
      put(label!, label_);
      put(role!, roleWord);
      const firsts = rs
        .map((r) => r.firstEventMs)
        .filter((x): x is number => typeof x === 'number');
      put(first!, firsts.length ? `${num(Math.min(...firsts))} ms` : NONE);
      const events = rs.reduce((n, r) => n + r.eventsReceived, 0);
      const dups = rs.reduce((n, r) => n + r.duplicatesDropped, 0);
      put(dup!, events ? `${num(Math.round((dups / events) * 1000) / 10)}%` : NONE);
      const coolMs = Math.max(0, ...rs.map((r) => r.cooldownRemainingMs ?? 0));
      put(cool!, coolMs > 0 ? t('orch.cooldown', { s: Math.ceil(coolMs / 1000) }) : '');
    },
  };
}

export function createFlow() {
  const views = h('div', { class: 'olist' });
  const reqs = h('div', { class: 'olist' });
  const relays = h('div', { class: 'olist' });
  const node = h(
    'div',
    { class: 'oband oflow' },
    column(t('orch.views'), views),
    column(t('orch.requests'), reqs),
    column(t('orch.relays'), relays, relayHead()),
  );
  const steadyViews = createSteadyOrder(views);
  const steadyRelays = createSteadyOrder(relays);
  const envNo = new Map<string, number>(); // bound: envelopes the engine reports now
  let nextNo = 1;
  const viewRows = new Map<string, ReturnType<typeof viewRow>>(); // bound: reported views
  const relayRows = new Map<string, ReturnType<typeof relayRow>>(); // bound: drawn relay lines

  const drawRequests = (s: OrchStats, ctx: Ctx): Map<string, number> => {
    const groups = new Map<string, OrchRequest[]>();
    for (const r of s.requests ?? []) groups.set(r.wireId, [...(groups.get(r.wireId) ?? []), r]);
    for (const id of envNo.keys()) if (!groups.has(id)) envNo.delete(id);
    for (const id of groups.keys()) if (!envNo.has(id)) envNo.set(id, nextNo++);
    const rank = (g: readonly OrchRequest[]): number =>
      Math.min(...g.map((r) => PURPOSE.indexOf(r.purpose)));
    const chips = [...groups]
      .sort(([a, x], [b, y]) => rank(x) - rank(y) || envNo.get(a)! - envNo.get(b)!)
      .map(([id, g]) => {
        const first = g[0]!;
        const shared = Math.max(g.length, ...g.map((r) => r.members));
        const purposeKey = `stats.purpose.${first.purpose}`;
        const role = g.find((r) => r.role)?.role;
        const bar = h('span', { class: 'odue' });
        const due = g.find((r) => r.hedgeDueAtMs != null && r.createdAtMs !== undefined);
        if (due && s.nowMs !== undefined) {
          const span_ = due.hedgeDueAtMs! - due.createdAtMs!;
          const part =
            span_ > 0 ? Math.min(1, Math.max(0, (s.nowMs - due.createdAtMs!) / span_)) : 1;
          bar.style.width = `${Math.round(part * 100)}%`;
        } else bar.hidden = true;
        const news =
          role === 'hedge' &&
          s.nowMs !== undefined &&
          g.some((r) => r.createdAtMs !== undefined && s.nowMs! - r.createdAtMs < NEWS_MS);
        return h(
          'div',
          {
            class: `orow ochipenv${first.purpose === 'prefetch' ? ' dotted' : ''}${news ? ' news' : ''}`,
          },
          h('span', { class: 'oenv' }, t('orch.envelope', { n: envNo.get(id)! })),
          h('span', { class: 'oshared' }, shared > 1 ? t('orch.shared', { n: shared }) : ''),
          h('span', { class: 'opurpose' }, hasKey(purposeKey) ? t(purposeKey) : ''),
          h('span', { class: 'orole' }, role ? t(`orch.${role}`) : ''),
          h('span', { class: 'ojoin' }, `→ ${relayWord(first.relay, s.relays, ctx.safe)}`),
          h('span', { class: 'otrack' }, bar),
        );
      });
    reqs.replaceChildren(...chips);
    node.querySelector('.ocol:nth-child(2)')!.toggleAttribute('hidden', !s.requests);
    return envNo;
  };

  return {
    node,
    draw(s: OrchStats, ctx: Ctx): void {
      const nos = drawRequests(s, ctx);
      const joined = (v: OrchView): string => {
        const ids = (s.requests ?? [])
          .filter((r) => r.memberSubs?.includes(v.subId))
          .map((r) => r.wireId);
        return [...new Set(ids)]
          .map((id) => `→ ${t('orch.envelope', { n: nos.get(id)! })}`)
          .join(' ');
      };
      const vs = s.views ?? [];
      const rank = (v: OrchView): number => (v.focused ? 0 : v.visible ? 1 : 2);
      const sorted = [...vs].sort((a, b) => rank(a) - rank(b));
      for (const id of viewRows.keys()) if (!vs.some((v) => v.subId === id)) viewRows.delete(id);
      const vnodes = steadyViews(sorted.map((v) => v.subId)).map((id) => {
        const v = vs.find((x) => x.subId === id)!;
        const row = viewRows.get(id) ?? viewRow();
        viewRows.set(id, row);
        row.set(v, ctx, joined(v));
        return row.el;
      });
      place(views, vnodes);
      node.querySelector('.ocol')!.toggleAttribute('hidden', !s.views);

      const lines = relayLines(s.relays, ctx.safe);
      const roleOf = (rs: readonly OrchRelay[]): string => {
        const mine = (s.requests ?? []).filter((r) => rs.some((x) => x.url === r.relay) && r.role);
        const role = mine.find((r) => r.role === 'hedge')?.role ?? mine[0]?.role;
        return role ? t(`orch.${role}`) : '';
      };
      for (const k of relayRows.keys()) if (!lines.some((l) => l.key === k)) relayRows.delete(k);
      const rnodes = steadyRelays(lines.map((l) => l.key)).map((k) => {
        const l = lines.find((x) => x.key === k)!;
        const row = relayRows.get(k) ?? relayRow();
        relayRows.set(k, row);
        row.set(l.label, l.members, roleOf(l.members), false);
        return row.el;
      });
      place(relays, rnodes);
    },
  };
}
