// The Relays tab: the reader's own list first, each relay in the state it is really in, with what it is used for
// (read, write) as two switches; then the relays the engine uses for other reasons; relays not in use are folded
// away with the reason. A removal can be taken back, and a removed relay stays at hand in the folded list.
import type { RelayEntry, RelayRow, Row } from '../engine/protocol.ts';
import { hostOf, relayAddress } from '../shared/address.ts';
import { clockOf, countText, dayOf } from '../shared/format.ts';
import { h } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { type Keyed, reconcile, watchList } from './lists.ts';
import { act } from './note-actions.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const listed = (r: RelayRow): boolean => r.read || r.write;
const entry = ({ url, read, write }: RelayEntry): RelayEntry => ({ url, read, write });

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
  const state = loadViewState<{ unused?: boolean }>(env.instance);
  let rows: RelayRow[] = [];
  const mine = (): RelayEntry[] => rows.filter(listed).map(entry);
  const save = (relays: readonly RelayEntry[]): void =>
    void act(env, (as) => ({ a: 'relays.save', as, relays }));
  /** Adds or changes one relay of the list, at `at` or where it already is. */
  const put = (e: RelayEntry, at?: number): void => {
    const list = mine();
    const had = list.findIndex((r) => r.url === e.url);
    if (had >= 0) list.splice(had, 1);
    list.splice(Math.min(at ?? (had >= 0 ? had : list.length), list.length), 0, e);
    save(list);
  };
  const remove = (r: RelayRow): void => {
    const list = mine();
    const at = list.findIndex((x) => x.url === r.url);
    const was = list[at];
    if (!was) return;
    save(list.filter((x) => x !== was));
    toast(env.layer, t('relays.removed', { host: hostOf(r.url) }), () => put(was, at));
  };
  const flip = (r: RelayRow, which: 'read' | 'write'): void => {
    const next = { ...entry(r), [which]: !r[which] };
    if (next.read || next.write) put(next);
    else remove(r); // neither read nor written: off the list
  };

  const row = (r: RelayRow): HTMLElement => {
    const sw = (which: 'read' | 'write'): HTMLElement =>
      h(
        'button',
        {
          class: r[which] ? 'rtog on' : 'rtog',
          'data-f': which,
          'aria-pressed': r[which],
          title: t(`relays.${which}.d`),
          onclick: () => flip(r, which),
        },
        t(`relays.${which}`),
      );
    const drop = t('relays.remove', { host: hostOf(r.url) });
    return h(
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
        ? [
            sw('read'),
            sw('write'),
            h(
              'button',
              {
                class: 'x',
                'data-f': 'remove',
                title: drop,
                'aria-label': drop,
                onclick: () => remove(r),
              },
              '×',
            ),
          ]
        : h(
            'button',
            {
              class: 'chip',
              'data-f': 'add',
              onclick: () => put({ ...entry(r), read: true, write: true }),
            },
            t('relays.add'),
          ),
    );
  };

  const input = h('input', {
    type: 'text',
    inputmode: 'url',
    autocapitalize: 'off',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'wss://',
    'aria-label': t('relays.address'),
    oninput: () => input.removeAttribute('aria-invalid'),
  });
  const form = h(
    'form',
    {
      class: 'addrow',
      onsubmit: (e) => {
        e.preventDefault();
        if (!input.value.trim()) return;
        const url = relayAddress(input.value);
        const dup = rows.some((r) => r.url === url && listed(r));
        if (!url || dup) {
          input.setAttribute('aria-invalid', 'true');
          return toast(env.layer, t(url ? 'relays.already' : 'relays.invalid'));
        }
        input.value = '';
        put({ url, read: true, write: true });
      },
    },
    input,
    h('button', { class: 'btn', type: 'submit' }, t('relays.add')),
  );

  const lists = [
    h('div', { class: 'rlist' }),
    h('div', { class: 'rlist' }),
    h('div', { class: 'rlist' }),
  ];
  const caches: Keyed[] = [new Map(), new Map(), new Map()]; // bound: the rows of each list
  const none = h('div', { class: 'fstate muted' });
  const othersHead = h('h3', { class: 'rhead' }, t('relays.others'));
  const summary = h('summary');
  const fold = h('details', { class: 'rfold', open: state.unused === true }, summary, lists[2]);
  fold.addEventListener('toggle', () => {
    state.unused = fold.open;
    saveViewState(env.instance, state);
  });
  const draw = (all: readonly Row[], loaded: boolean): void => {
    rows = all.filter((r): r is RelayRow => r.kind === 'relay');
    const parts = [
      rows.filter(listed),
      rows.filter((r) => !listed(r) && r.inUse),
      rows.filter((r) => !listed(r) && !r.inUse),
    ];
    parts.forEach((part, i) => {
      const list = lists[i];
      const cache = caches[i];
      if (list && cache) reconcile(list, cache, part, row);
    });
    none.textContent = !loaded ? t('feed.loading') : parts[0]?.length ? '' : t('relays.none');
    othersHead.hidden = !parts[1]?.length;
    fold.hidden = !parts[2]?.length;
    summary.textContent = t('relays.unused', { n: parts[2]?.length ?? 0 });
  };
  el.classList.add('pad', 'relaysv');
  el.tabIndex = -1;
  el.replaceChildren(form, lists[0] ?? '', none, othersHead, lists[1] ?? '', fold);
  return watchList(env, 'relays', draw);
}
