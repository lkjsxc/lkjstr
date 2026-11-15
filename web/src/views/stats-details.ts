// One expanded row per table, retained with the tab. Detail text mirrors the wide cells.
import { hostOf } from '../shared/address.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';

export const compoundTitle = (key: string): string => {
  const titles: Record<string, Key> = {
    publishAccepted: 'stats.publishAcceptedParts',
    publishPending: 'stats.publishPendingParts',
    publishOwnSkipped: 'stats.publishLimits',
    data: 'stats.dataParts',
  };
  return titles[key] ? t(titles[key]) : '';
};

/** Split inside the host; the complete address remains available as a title. */
export function relayName(url: string): HTMLElement {
  const text = hostOf(url);
  const slash = text.indexOf('/');
  const end = slash < 0 ? text.length : slash;
  const split = Math.max(1, end - (slash < 0 ? Math.min(6, Math.ceil(end / 3)) : 2));
  return h(
    'span',
    { class: 'rhost stats-host', title: url },
    h('span', { class: 'stats-host-start' }, text.slice(0, split)),
    h('span', { class: 'stats-host-tail' }, text.slice(split)),
  );
}

export function createStatsDetails(instance: string, field: 'relayOpen' | 'requestOpen') {
  let open = loadViewState<Record<string, string>>(instance)[field];
  // Bound: the engine's relay/request rows; callers release removed entries.
  const entries = new Map<string, { row: HTMLElement; detail: HTMLElement }>();
  const paint = () => {
    for (const [id, entry] of entries) {
      entry.detail.hidden = id !== open;
      entry.row.setAttribute('aria-expanded', String(id === open));
    }
  };
  return {
    add(id: string, row: HTMLElement, columns: readonly (readonly [string, Key])[]) {
      const values = columns.map(([key, label]) => ({ key, value: h('dd'), label }));
      const detail = h(
        'tr',
        { class: 'stats-detail', hidden: true },
        h(
          'td',
          { colspan: field === 'relayOpen' ? 3 : 2 },
          h(
            'dl',
            null,
            ...values.flatMap(({ key, value, label }) => [
              h('dt', { title: compoundTitle(key) }, t(label)),
              value,
            ]),
          ),
        ),
      );
      entries.set(id, { row, detail });
      row.tabIndex = 0;
      row.classList.add('stats-toggle');
      const toggle = () => {
        open = open === id ? undefined : id;
        saveViewState(instance, { ...loadViewState(instance), [field]: open });
        paint();
      };
      row.addEventListener('click', toggle);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') event.preventDefault(), toggle();
      });
      paint();
      return {
        detail,
        update() {
          for (const { key, value } of values) {
            const cell = row.querySelector<HTMLElement>(`.c-${key}`);
            value.textContent = cell?.textContent ?? '—';
            value.title = cell?.title || compoundTitle(key);
          }
        },
      };
    },
    remove(id: string) {
      entries.delete(id);
    },
  };
}
