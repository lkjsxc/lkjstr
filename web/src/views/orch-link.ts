// The link band: three 60-second sparklines on a shared axis, newest at the right, each with its number.
// Scales are per line, 0 to the window's maximum, with no smoothing. Duplicates are "dropped", not "saved".
import { h, svg } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { NONE, num, type OrchBucket, type OrchStats, put } from './orch-model.ts';
import { bytesText } from './stats.ts';

const W = 600;
const H = 40;
const SLOTS = 60;

function points(values: readonly number[], top: number): string {
  const step = W / (SLOTS - 1);
  const off = SLOTS - values.length;
  return values
    .map(
      (v, i) =>
        `${((off + i) * step).toFixed(1)},${(H - (top ? (v / top) * (H - 2) : 0) - 1).toFixed(1)}`,
    )
    .join(' ');
}

function spark(label: Key) {
  const main = svg('polyline', { class: 'omain', points: '', fill: 'none' });
  const second = svg('polyline', { class: 'osecond', points: '', fill: 'none' });
  const ticks = svg('g', { class: 'oticks' });
  const pic = svg(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    second,
    main,
    ticks,
  );
  const top = h('span', { class: 'otop' });
  const value = h('span', { class: 'oval' });
  const node = h(
    'div',
    { class: 'ospark' },
    h('span', { class: 'olabel' }, t(label)),
    h('div', { class: 'opic' }, pic, top),
    value,
  );
  return { node, main, second, ticks, top, value };
}

export function createLink() {
  const lines = {
    bytes: spark('orch.in'),
    dup: spark('orch.dupDropped'),
    reqs: spark('orch.reqsSent'),
  };
  const node = h(
    'section',
    { class: 'oband olink', 'aria-label': t('orch.link') },
    h('div', { class: 'ohead' }, t('orch.link')),
    ...Object.values(lines).map((l) => l.node),
  );
  const perSecond = (v: string): string => t('orch.perSecond', { v });
  return {
    node,
    draw(s: OrchStats): void {
      const hist: readonly OrchBucket[] = (s.bandwidthHistory ?? []).slice(-SLOTS);
      node.hidden = !s.bandwidthHistory;
      if (!hist.length) {
        for (const l of Object.values(lines)) put(l.value, NONE);
        return;
      }
      const last = hist.at(-1)!;
      const ins = hist.map((b) => b.bytesIn);
      const outs = hist.map((b) => b.bytesOut);
      const bTop = Math.max(0, ...ins, ...outs);
      lines.bytes.main.setAttribute('points', points(ins, bTop));
      lines.bytes.second.setAttribute('points', points(outs, bTop));
      put(lines.bytes.top, bytesText(bTop));
      put(lines.bytes.value, perSecond(bytesText(last.bytesIn)));
      lines.bytes.node.title = `${t('orch.out')} ${perSecond(bytesText(last.bytesOut))}`;

      const dups = hist.map((b) => b.duplicates);
      const dTop = Math.max(0, ...dups);
      lines.dup.main.setAttribute('points', points(dups, dTop));
      put(lines.dup.top, num(dTop));
      put(lines.dup.value, perSecond(num(last.duplicates)));
      if (last.duplicateBytes !== undefined) lines.dup.node.title = bytesText(last.duplicateBytes);

      const reqs = hist.map((b) => b.reqsSent);
      const rTop = Math.max(0, ...reqs);
      const step = W / (SLOTS - 1);
      const off = SLOTS - reqs.length;
      lines.reqs.ticks.replaceChildren(
        ...reqs.flatMap((n, i) =>
          n
            ? [
                svg('line', {
                  x1: (off + i) * step,
                  x2: (off + i) * step,
                  y1: H - 1,
                  y2: H - 1 - (n / rTop) * (H - 2),
                }),
              ]
            : [],
        ),
      );
      put(lines.reqs.top, num(rTop));
      const coalesced = hist.some((b) => b.reqsCoalesced !== undefined)
        ? hist.reduce((n, b) => n + (b.reqsCoalesced ?? 0), 0)
        : undefined;
      put(
        lines.reqs.value,
        coalesced === undefined
          ? perSecond(num(last.reqsSent))
          : `${t('orch.reqSaved')} ${num(coalesced)}`,
      );
    },
  };
}
