import type { EngineStats } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { getLang, type Key, t } from '../shared/i18n.ts';

const fields = [
  ['pending', 'stats.signerWaiting'],
  ['latencyMs', 'stats.signerResponse'],
  ['callsPerMinute', 'stats.signerRate'],
  ['timeouts', 'stats.signerTimeouts'],
] as const satisfies readonly (readonly [string, Key])[];

export function createSignerStats(integer: (value: number) => string) {
  const values = fields.map(([key, label]) => ({
    key,
    label: h('dt', null, t(label)),
    value: h('dd', { 'data-signer-stat': key }),
  }));
  const rows = h(
    'dl',
    { class: 'ssub', hidden: true },
    ...values.flatMap(({ label, value }) => [label, value]),
  );
  const detail = h('div', { class: 'ssub muted', hidden: true });
  const node = h(
    'div',
    { class: 'sfig signer-stats' },
    h('div', { class: 'slabel' }, t('stats.signer')),
    rows,
    detail,
  );
  const seconds = new Intl.NumberFormat(getLang(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return {
    node,
    update(stats: EngineStats['extensionSigner']): void {
      // Only an available extension supplies these values. The muted line explains its absence.
      rows.hidden = !stats?.available;
      const note =
        stats &&
        (!stats.available
          ? 'stats.signerAbsent'
          : stats.pending > 0
            ? 'stats.signerActive'
            : undefined);
      const line = note ? t(note) : '';
      if (detail.textContent !== line) detail.textContent = line;
      detail.hidden = !line;
      if (!stats?.available) return;
      for (const { key, value } of values) {
        const n = stats[key];
        const next =
          n === null
            ? '—'
            : key === 'latencyMs'
              ? t('stats.signerSeconds', { n: seconds.format(n / 1000) })
              : integer(n);
        if (value.textContent !== next) value.textContent = next;
      }
    },
  };
}
