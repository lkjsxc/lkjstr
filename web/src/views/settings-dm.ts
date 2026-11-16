// M4 keeps edits local until the explicit publication succeeds.
import type { RelayRow } from '../engine/protocol.ts';
import { hostOf, relayAddress } from '../shared/address.ts';
import { h } from '../shared/h.ts';
import { both, t } from '../shared/i18n.ts';
import { able, failureText } from './can.ts';
import { watchList } from './lists.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';
import { listed } from './relays.ts';
import { type Entry, frame, searchText } from './settings-entry.ts';
import { addForm, removeButton } from './settings-lists.ts';

export function inboxRelayEntry(env: ViewEnv): { entry: Entry; dispose(): void } {
  let account = '',
    published: readonly string[] | undefined,
    edited: string[] = [],
    writes: string[] = [];
  let dirty = false,
    busy = false,
    stopped = false,
    epoch = 0;
  const list = h('div', { class: 'slist' }),
    suggestion = h('div', { class: 'muted' });
  const equal = (a: readonly string[], b: readonly string[]): boolean =>
    JSON.stringify(a) === JSON.stringify(b);
  const suggest = (): void => {
    if (!dirty && !published?.length) edited = writes.slice(0, 3);
  };
  const remove = (url: string): void => {
    const at = edited.indexOf(url),
      owner = account,
      lease = epoch;
    if (at < 0) return;
    edited.splice(at, 1);
    dirty = true;
    draw();
    toast(env.layer, t('relays.removed', { host: hostOf(url) }), () => {
      if (stopped || account !== owner || epoch !== lease || edited.includes(url)) return;
      edited.splice(Math.min(at, edited.length), 0, url);
      dirty = true;
      draw();
    });
  };
  const save = h('button', { class: 'btn primary' }, t('set.dmRelays.save'));
  const form = addForm('wss://', t('relays.address'), (value) => {
    const url = relayAddress(value);
    if (!url) {
      toast(env.layer, t('relays.invalid'));
      return false;
    }
    if (edited.some((old) => old.replace(/\/$/, '') === url.replace(/\/$/, ''))) {
      toast(env.layer, t('relays.already'));
      return false;
    }
    edited.push(url);
    dirty = true;
    draw();
    return true;
  });
  function draw(): void {
    const owner = env.engine.accounts.get().accounts.find((a) => a.author.pubkey === account);
    const disabled = busy || !owner || owner.signer === 'none' || owner.locked === true;
    list.replaceChildren(
      ...edited.map((url) =>
        h(
          'div',
          { class: 'srow rrow' },
          h('span', { class: 'clip rhost', title: url }, hostOf(url)),
          removeButton(hostOf(url), () => remove(url)),
        ),
      ),
    );
    for (const control of [
      ...form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button'),
      ...list.querySelectorAll<HTMLButtonElement>('button'),
    ])
      control.disabled = disabled;
    save.disabled = disabled || equal(edited, published ?? []);
    save.classList.toggle('primary', !save.disabled);
    suggestion.textContent =
      !published?.length && !dirty && edited.length ? t('set.dmRelays.suggest') : '';
  }
  const sync = (): void => {
    const owner = env.engine.accounts
      .get()
      .accounts.find((a) => a.author.pubkey === env.engine.me());
    const key = owner?.author.pubkey ?? '';
    if (key !== account) {
      account = key;
      epoch++;
      published = owner?.inbox;
      edited = [...(published ?? [])];
      writes = [];
      dirty = false;
      busy = false;
    } else if (
      owner?.inbox !== undefined &&
      (published === undefined || !equal(owner.inbox, published))
    ) {
      published = owner.inbox;
      if (!dirty && !busy) edited = [...published];
    }
    suggest();
    draw();
  };
  save.addEventListener('click', () => {
    if (!able(env) || busy) return;
    const owner = account,
      lease = epoch,
      relays = [...edited];
    busy = true;
    draw();
    void env.engine.act({ a: 'dm.relays.save', as: owner, relays }).then((result) => {
      if (stopped || account !== owner || epoch !== lease) return;
      busy = false;
      if (result.ok) {
        published = relays;
        dirty = false;
        toast(env.layer, t('set.dmRelays.saved'));
      } else toast(env.layer, failureText(result.error));
      draw();
    });
  });
  const [group = '', title = ''] = t('set.dmRelays').split(': ');
  const node = frame(
    group,
    title,
    null,
    h('div', { class: 'muted' }, t('set.dmRelays.d')),
    h('div', { class: 'sbox', tabindex: -1 }, list),
    suggestion,
    form,
    h('div', { class: 'actions' }, save),
  );
  node.dataset.entry = 'dmRelays';
  const off = env.engine.accounts.subscribe(sync);
  sync();
  const stopRelays = watchList(env, 'relays', (rows) => {
    writes = rows
      .filter((row): row is RelayRow => row.kind === 'relay')
      .filter((row) => listed(row) && row.write)
      .map((row) => row.url);
    suggest();
    draw();
  });
  return {
    entry: {
      group,
      text: searchText(both('set.dmRelays'), both('set.dmRelays.d'), 'dmRelays'),
      node,
      sync: () => !equal(edited, published ?? []),
    },
    dispose(): void {
      stopped = true;
      epoch++;
      off();
      stopRelays();
      edited = [];
    },
  };
}
