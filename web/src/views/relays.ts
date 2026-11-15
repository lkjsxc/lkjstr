// The Relays tab shows state and changes nothing: one flat list of every relay the engine knows, in the engine's
// order (the reader's own list first), each in the state it is really in, with what it is used for (read, write)
// or, for a relay that is not on the reader's list, why it is there. The list itself is edited in Settings, one
// press away from the tile's menu.
import type { RelayRow, Row } from '../engine/protocol.ts';
import { hostOf } from '../shared/address.ts';
import { clockOf, countText, dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { type Keyed, reconcile, watchList } from './lists.ts';
import type { ViewEnv } from './registry.ts';

export const listed = (r: RelayRow): boolean => r.read || r.write;

/** What is known about a relay, in words: its state first, the relay's own words for an error as they came. */
export function relayFacts(r: RelayRow, now = Date.now()): string {
  const out: string[] = [t(`relay.${r.state}`)];
  // Why it is used or not; an error in the relay's own words already says why it is not answering.
  if (r.why === 'blocked' || (r.why === 'failing' ? !r.error : !listed(r)))
    out.push(t(`relay.why.${r.why}`));
  if (r.error) out.push(r.error);
  if (r.retryAt) {
    const day = dayOf(r.retryAt) === dayOf(now) ? '' : `${dayOf(r.retryAt)} `;
    out.push(t('relay.retry', { time: `${day}${clockOf(r.retryAt)}` }));
  }
  if (r.state === 'connected' && r.latencyMs !== undefined) out.push(`${r.latencyMs} ms`);
  if (r.events) out.push(t('relay.events', { n: countText(r.events, false, getLang()) }));
  return out.join(' · ');
}

export function mountRelays(el: HTMLElement, env: ViewEnv): () => void {
  const edit = (): void => env.open('settings', { at: 'set.relayList' });
  const row = (r: RelayRow): HTMLElement =>
    h(
      'div',
      { class: `rrow s-${r.state}` },
      h('span', { class: 'rdot', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'rmain' },
        h(
          'div',
          { class: 'clip', title: [r.url, r.software].filter(Boolean).join('\n') },
          h('span', { class: 'rhost' }, hostOf(r.url)),
          r.name ? h('span', { class: 'muted' }, `  ${r.name}`) : null,
        ),
        h('div', { class: 'rsub muted' }, relayFacts(r)),
      ),
      listed(r)
        ? h(
            'span',
            { class: 'ruse' },
            [r.read ? t('relays.read') : '', r.write ? t('relays.write') : '']
              .filter(Boolean)
              .join(' · '),
          )
        : null,
    );

  const list = h('div', { class: 'rlist' });
  const cache: Keyed = new Map(); // bound: the relay rows
  const none = h('div', { class: 'fstate muted' });
  const toEdit = h('button', { class: 'lnk', onclick: edit }, t('relays.edit'));
  const draw = (all: readonly Row[], loaded: boolean): void => {
    const rows = all.filter((r): r is RelayRow => r.kind === 'relay');
    reconcile(list, cache, rows, row);
    const mine = rows.some(listed);
    none.replaceChildren(
      !loaded ? t('feed.loading') : mine ? '' : t('relays.none'),
      loaded && !mine ? ' ' : '',
      loaded && !mine ? toEdit : '',
    );
  };
  el.classList.add('pad', 'relaysv');
  el.tabIndex = -1;
  el.replaceChildren(none, list);
  env.menu(() => [
    { label: t('relays.edit'), run: edit },
    { label: t('view.stats'), run: () => env.open('stats') },
  ]);
  return watchList(env, 'relays', draw);
}
