// The windows band: one row per open timeline view. With held and cached time spans the row is a bar on its own
// time axis (cache span, held window, the Moment tick); without them it is the caps and words alone.
import type { OrchestrationCoverage } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { num, type OrchStats, type OrchView, viewWord } from './orch-model.ts';

const COV: Record<OrchestrationCoverage, Key> = {
  end: 'orch.cov.end',
  partial: 'orch.cov.partial',
  loading: 'orch.cov.loading',
  stalled: 'orch.cov.stalled',
  'cache-only': 'orch.cov.cacheOnly',
  unsupported: 'orch.cov.unsupported',
};
const TIMELINE = new Set([
  'home',
  'their-home',
  'global',
  'notifications',
  'hashtag',
  'search',
  'profile',
  'relay',
  'channel',
  'list',
]);

function bar(v: OrchView, when: (ms: number) => string): HTMLElement | undefined {
  const lo = Math.min(
    ...[v.cacheOldestAtMs, v.oldestAtMs].filter((x): x is number => x !== undefined),
  );
  const hi = Math.max(
    ...[v.cacheNewestAtMs, v.newestAtMs].filter((x): x is number => x !== undefined),
  );
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return undefined;
  const at = (ms: number): string => `${(((ms - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  const seg = (cls: string, a?: number, b?: number): HTMLElement | undefined =>
    a === undefined || b === undefined
      ? undefined
      : h('span', { class: cls, style: `left:${at(a)};width:calc(${at(b)} - ${at(a)})` });
  const tick =
    v.anchorAtMs !== undefined && v.anchorAtMs >= lo && v.anchorAtMs <= hi
      ? h('span', { class: 'otick', style: `left:${at(v.anchorAtMs)}` })
      : undefined;
  const cap = (end: 'older' | 'newer', c?: OrchestrationCoverage) =>
    h('span', { class: `ocap ${end} c-${c ?? 'none'}` });
  return h(
    'div',
    { class: 'obar', 'aria-hidden': 'true', title: `${when(lo)} – ${when(hi)}` },
    cap('older', v.olderCoverage),
    seg('ocache', v.cacheOldestAtMs, v.cacheNewestAtMs),
    seg('oheld', v.oldestAtMs, v.newestAtMs),
    tick,
    cap('newer', v.newerCoverage),
  );
}

export function createWindows() {
  const list = h('div', { class: 'olist' });
  const node = h(
    'section',
    { class: 'oband owindows', 'aria-label': t('orch.windows') },
    h('div', { class: 'ohead' }, t('orch.windows')),
    list,
  );
  return {
    node,
    draw(s: OrchStats, when: (ms: number) => string): void {
      const views = (s.views ?? []).filter((v) => TIMELINE.has(v.sourceKind ?? v.source));
      node.hidden = !views.length;
      list.replaceChildren(
        ...views.map((v) => {
          const where =
            v.windowKind === 'top'
              ? t('orch.top')
              : v.anchorAtMs !== undefined
                ? t('orch.anchor', { time: when(v.anchorAtMs) })
                : '';
          const cov = (k: 'orch.older' | 'orch.newer', c?: OrchestrationCoverage) =>
            c ? t(k, { state: t(COV[c]) }) : '';
          return h(
            'div',
            { class: `orow owin${v.visible ? '' : ' hid'}` },
            h('span', { class: 'olbl' }, viewWord(v, when)),
            bar(v, when) ?? h('span', { class: 'obar none' }),
            h('span', { class: 'owhere' }, where),
            h('span', { class: 'onum' }, t('orch.rows', { n: num(v.rowCount) })),
            h(
              'span',
              { class: 'ocov' },
              [cov('orch.older', v.olderCoverage), cov('orch.newer', v.newerCoverage)]
                .filter(Boolean)
                .join(' · '),
            ),
            v.freshCount > 0
              ? h('span', { class: 'ofresh' }, t('orch.fresh', { n: num(v.freshCount) }))
              : null,
          );
        }),
      );
    },
  };
}
