// Settings: the reader's relay list. Here, and only here, relays are added, removed and set to read or write
// (the Relays tab shows how they are doing). Every change is the whole list saved again; a removal can be taken
// back and the relay returns to the place it had.
import type { RelayEntry, RelayRow, Row } from '../engine/protocol.ts';
import { hostOf, relayAddress } from '../shared/address.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import type { Disposer } from '../shared/signal.ts';
import { watchList } from './lists.ts';
import { act } from './note-actions.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { listed, relayFacts } from './relays.ts';
import type { Entry } from './settings-entry.ts';
import { addForm, entryOf, listBox, removeButton } from './settings-lists.ts';

const entry = ({ url, read, write }: RelayEntry): RelayEntry => ({ url, read, write });

export function relayEntry(env: ViewEnv): { entry: Entry; dispose: Disposer } {
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
    return h(
      'div',
      { class: `srow rrow s-${r.state}` },
      h('span', { class: 'rdot', 'aria-hidden': 'true' }),
      h('span', { class: 'clip rhost', title: `${r.url}\n${relayFacts(r)}` }, hostOf(r.url)),
      sw('read'),
      sw('write'),
      removeButton(hostOf(r.url), () => remove(r)),
    );
  };
  const box = listBox<RelayRow>('relays.none', row);
  const form = addForm('wss://', t('relays.address'), (text) => {
    const url = relayAddress(text);
    if (!url) return (toast(env.layer, t('relays.invalid')), false);
    if (rows.some((r) => r.url.replace(/\/$/, '') === url && listed(r)))
      return (toast(env.layer, t('relays.already')), false);
    put({ url, read: true, write: true });
    return true;
  });
  const off = watchList(env, 'relays', (all: readonly Row[], loaded) => {
    rows = all.filter((r): r is RelayRow => r.kind === 'relay');
    box.draw(rows.filter(listed), loaded);
  });
  const state = h(
    'div',
    { class: 'actions' },
    h('button', { class: 'lnk', onclick: () => env.open('relays') }, t('relays.state')),
  );
  return { entry: entryOf('set.relayList', box.el, form, state), dispose: off };
}
