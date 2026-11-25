// The figures band: six numbers in fixed slots, then the Stage-safe, Large and Pause chips.
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { NONE, num, type OrchStats, put } from './orch-model.ts';
import { bytesText } from './stats.ts';

export type Modes = { safe: boolean; large: boolean; paused: boolean };
type Chip = 'safe' | 'large' | 'paused';

export function createFigures(modes: Modes, toggle: (chip: Chip) => void) {
  const figure = (label: Key) => {
    const val = h('div', { class: 'oval' }, NONE);
    const node = h('div', { class: 'ofig' }, h('div', { class: 'olabel' }, t(label)), val);
    return { node, val };
  };
  const f = {
    in: figure('orch.in'),
    dup: figure('orch.dupDropped'),
    saved: figure('orch.reqSaved'),
    verify: figure('orch.verifyQueue'),
    views: figure('orch.views'),
    relays: figure('orch.relaysLive'),
  };
  const chip = (id: Chip, label: Key, hint: Key) =>
    h(
      'button',
      {
        class: 'ochip',
        'data-chip': id,
        title: t(hint),
        'aria-pressed': modes[id],
        onclick: () => toggle(id),
      },
      t(label),
    );
  const chips = {
    safe: chip('safe', 'orch.stageSafe', 'orch.stageSafe.hint'),
    large: chip('large', 'orch.large', 'orch.large.hint'),
    paused: chip('paused', 'orch.pause', 'orch.pause.hint'),
  };
  const frozen = h('span', { class: 'ofrozen' });
  const node = h(
    'div',
    { class: 'ofigs', role: 'group', 'aria-label': t('view.orchestration') },
    ...Object.values(f).map((x) => x.node),
    h('div', { class: 'ochips' }, frozen, chips.safe, chips.large, chips.paused),
  );
  const perSecond = (v: string): string => t('orch.perSecond', { v });
  return {
    node,
    modes(m: Modes, frozenAt?: string): void {
      for (const id of ['safe', 'large', 'paused'] as const)
        chips[id].setAttribute('aria-pressed', String(m[id]));
      put(frozen, m.paused && frozenAt ? t('orch.paused', { time: frozenAt }) : '');
    },
    draw(s: OrchStats): void {
      const last = s.bandwidthHistory?.at(-1);
      put(f.in.val, last ? perSecond(bytesText(last.bytesIn)) : NONE);
      put(f.dup.val, last ? perSecond(num(last.duplicates)) : NONE);
      const hist = s.bandwidthHistory ?? [];
      const coalesced = hist.some((b) => b.reqsCoalesced !== undefined)
        ? hist.reduce((n, b) => n + (b.reqsCoalesced ?? 0), 0)
        : s.orchestration.requestsCoalesced;
      put(f.saved.val, num(coalesced));
      const w = s.worker;
      put(
        f.verify.val,
        w
          ? `${num(w.verifyQueueLen)}/${w.verifyQueueCap === undefined ? NONE : num(w.verifyQueueCap)}`
          : NONE,
      );
      put(f.views.val, s.views ? num(s.views.length) : NONE);
      const up = s.relays.filter((r) => r.state === 'connected').length;
      put(f.relays.val, num(up));
    },
  };
}
