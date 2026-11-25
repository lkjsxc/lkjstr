// The optimizer band, drawn only when the engine reports an `optimizer` block: stage and part switches, the
// variables with their sources (Stage 1 values beside learned ones), author weight classes and keep scores.
// Keep rows carry class, weight, age, size and score: no id, name or content in any mode.
import { h } from '../shared/h.ts';
import { hasKey, type Key, t } from '../shared/i18n.ts';
import { type KeepItem, num, type Optimizer, type OrchStats } from './orch-model.ts';
import { bytesText } from './stats.ts';

const VAR_KEY: Record<string, Key> = {
  fanout: 'orch.var.fanout',
  hedgeDelay: 'orch.var.hedgeDelay',
  hedgeTarget: 'orch.var.hedgeTarget',
  limit: 'orch.var.limit',
  chunk: 'orch.var.chunk',
  prefetch: 'orch.var.prefetch',
  throughput: 'orch.var.throughput',
  rtt: 'orch.var.rtt',
  saturated: 'orch.var.saturated',
};
const word = (k: string): string => (hasKey(k) ? t(k) : '');
const value = (v: number | boolean, unit?: string): string =>
  typeof v === 'boolean'
    ? word(v ? 'orch.mode.on' : 'orch.mode.off')
    : `${num(v)}${unit ? ` ${unit}` : ''}`;

function keepRow(k: KeepItem, top: number): HTMLElement {
  const bar = h('span', { style: `width:${top ? Math.round((k.score / top) * 100) : 0}%` });
  return h(
    'div',
    { class: 'orow okeep' },
    h('span', { class: 'olbl' }, word(`orch.class.${k.class}`) || t('orch.class.other')),
    h('span', { class: 'onum' }, `w${num(k.weightClass)}`),
    h('span', { class: 'onum' }, `${num(k.ageH)} h`),
    h('span', { class: 'onum' }, bytesText(k.bytes)),
    h('span', { class: 'onum' }, num(Math.round(k.score * 100) / 100)),
    h('span', { class: 'oscore', 'aria-hidden': 'true' }, bar),
    h('span', { class: 'opin' }, k.pin ? t('orch.pinned', { why: word(`orch.pin.${k.pin}`) }) : ''),
  );
}

function body(o: Optimizer, when: (ms: number) => string): HTMLElement[] {
  const parts = (o.parts ?? []).map((p) =>
    h(
      'span',
      { class: `opart m-${p.mode}` },
      `${word(`orch.part.${p.id}`) || p.id}: `,
      p.trippedUntilMs
        ? t('orch.tripped', { time: when(p.trippedUntilMs) })
        : word(`orch.mode.${p.mode}`),
    ),
  );
  const head = h(
    'div',
    { class: 'oparts' },
    h('span', { class: 'ostage' }, t('orch.stage', { n: o.stage })),
    ...parts,
  );
  const vars = h(
    'div',
    { class: 'ovars' },
    ...(o.variables ?? []).flatMap((v) =>
      VAR_KEY[v.id]
        ? [
            h(
              'span',
              { class: 'ovar' },
              h('span', { class: 'olabel' }, t(VAR_KEY[v.id]!)),
              h('span', { class: 'onum' }, value(v.value, v.unit)),
              v.source === 'learned' && v.stage1Value !== undefined
                ? h('span', { class: 'ostage1' }, value(v.stage1Value, v.unit))
                : null,
              h('span', { class: 'osrc' }, word(`orch.src.${v.source}`)),
            ),
          ]
        : [],
    ),
  );
  const weights = o.weightClasses?.length
    ? h(
        'div',
        { class: 'oweights', 'aria-label': t('orch.weights') },
        h('span', { class: 'olabel' }, t('orch.weights')),
        ...o.weightClasses.map((w) =>
          h('span', { class: 'ofact' }, `w${num(w.weight)} ${num(w.count)}`),
        ),
      )
    : null;
  const keep = o.keep;
  const top = keep
    ? Math.max(0, ...keep.low.map((k) => k.score), ...keep.high.map((k) => k.score))
    : 0;
  const keepList = (label: Key, items: readonly KeepItem[]) =>
    h(
      'div',
      { class: 'okeeps' },
      h('div', { class: 'olabel' }, t(label)),
      ...items.slice(0, 8).map((k) => keepRow(k, top)),
    );
  return [
    head,
    vars,
    ...(weights ? [weights] : []),
    ...(keep
      ? [
          h(
            'div',
            { class: 'okeepcols' },
            keepList('orch.keepLow', keep.low),
            keepList('orch.keepHigh', keep.high),
          ),
        ]
      : []),
  ];
}

export function createOptimizer() {
  const inner = h('div');
  const node = h(
    'section',
    { class: 'oband oopt', 'aria-label': t('orch.optimizer') },
    h('div', { class: 'ohead' }, t('orch.optimizer')),
    inner,
  );
  return {
    node,
    draw(s: OrchStats, when: (ms: number) => string): void {
      node.hidden = !s.optimizer;
      if (s.optimizer) inner.replaceChildren(...body(s.optimizer, when));
    },
  };
}
