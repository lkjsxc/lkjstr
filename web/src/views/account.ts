// One account box per tab. Closing or leaving it releases all password and backup fields.
import type { Action } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { loadViewState, saveViewState } from '../shared/view-state.ts';
import { mountAdd } from './account-add.ts';
import { canKey, forget, isPending, keyBox, onPending } from './account-key.ts';
import { passwordForm } from './account-password.ts';
import { protectBox } from './account-protect.ts';
import { type AccountRow, accountRow } from './account-row.ts';
import { type AccountBox, canVault, lockedAccount, vaultFailure } from './account-vault.ts';
import { type Keyed, reconcile } from './lists.ts';
import { plainName, toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

type Kind = 'backup' | 'unlock' | 'protect';

export function mountAccount(el: HTMLElement, env: ViewEnv): () => void {
  const list = h('div', { class: 'alist' });
  const cache: Keyed = new Map(); // bound: 32 device accounts
  const failures = new Map<string, Key>();
  const locking = new Set<string>(); // bound: one in-flight lock per device account
  let opened: { pubkey: string; kind: Kind; handle: AccountBox; locked: boolean } | undefined;
  let asking = '';
  let disposed = false;
  const add = mountAdd(env);
  const state = loadViewState<{ unlock?: string }>(env.instance);
  let requested = state.unlock;
  if (state.unlock) {
    delete state.unlock;
    saveViewState(env.instance, state);
  }

  const dropBox = (): void => {
    opened?.handle.dispose();
    opened?.handle.el.remove();
    opened = undefined;
  };
  const focusRow = (pubkey: string): void =>
    cache
      .get(pubkey)
      ?.node.querySelector<HTMLElement>('[data-f="use"]')
      ?.focus({ preventScroll: true });
  const closeBox = (): void => {
    const pubkey = opened?.pubkey;
    dropBox();
    draw();
    if (pubkey && env.visible.get()) focusRow(pubkey);
  };
  const openBox = (pubkey: string, kind: Kind): void => {
    dropBox();
    const account = env.engine.accounts.get().accounts.find((a) => a.author.pubkey === pubkey);
    if (account?.signer !== 'local' || (kind !== 'backup' && !canVault(env.engine))) return;
    const handle =
      kind === 'backup'
        ? keyBox(env, pubkey, closeBox, () => openBox(pubkey, 'unlock'))
        : kind === 'protect'
          ? protectBox(env, pubkey, closeBox, () => openBox(pubkey, 'backup'), draw)
          : passwordForm({
              kind: 'unlock',
              submit: 'account.unlock',
              busy: 'account.busy.unlock',
              cancel: closeBox,
              send: (password) => env.engine.act({ a: 'account.unlock', pubkey, password }),
              success: closeBox,
            });
    if (kind === 'unlock') handle.el.classList.add('kbox');
    opened = { pubkey, kind, handle, locked: lockedAccount(env.engine, account) };
    draw();
    queueMicrotask(() => {
      if (opened?.handle === handle && env.visible.get()) handle.focus?.();
    });
  };
  const act = async (action: Action): Promise<boolean> => {
    const r = await env.engine.act(action);
    if (!r.ok && !disposed) toast(env.layer, t(`error.${r.error?.code ?? 'internal'}` as Key));
    return r.ok;
  };
  const remove = async (row: AccountRow): Promise<void> => {
    asking = '';
    if (opened?.pubkey === row.key) dropBox();
    if (!(await act({ a: 'account.remove', pubkey: row.key }))) return;
    forget(row.key);
    if (disposed) return;
    const { signer, author } = row.account;
    const again =
      signer === 'none'
        ? () => void act({ a: 'account.add', how: 'key', key: author.npub })
        : signer === 'extension'
          ? () => void act({ a: 'account.add', how: 'extension' })
          : undefined;
    toast(env.layer, t('account.removed', { name: plainName(author) }), again);
  };
  const lock = async (pubkey: string): Promise<void> => {
    if (locking.has(pubkey)) return;
    locking.add(pubkey);
    if (opened?.pubkey === pubkey) dropBox();
    failures.delete(pubkey);
    draw();
    const r = await env.engine.act({ a: 'account.lock', pubkey });
    locking.delete(pubkey);
    if (disposed) return;
    if (!r.ok) failures.set(pubkey, vaultFailure(r.error?.code, 'unlock'));
    draw();
  };

  function draw(): void {
    if (disposed) return;
    const all = env.engine.accounts.get();
    const able = canKey(env);
    const vault = canVault(env.engine);
    if (opened) {
      const account = all.accounts.find((a) => a.author.pubkey === opened?.pubkey);
      const locked = lockedAccount(env.engine, account);
      if (
        account?.signer !== 'local' ||
        (opened.kind !== 'backup' && !vault) ||
        (opened.kind === 'protect' && locked)
      )
        dropBox();
      else if (opened.kind === 'unlock' && !locked) {
        const pubkey = opened.pubkey;
        dropBox();
        queueMicrotask(() => focusRow(pubkey));
      } else if (opened.kind === 'backup' && locked !== opened.locked) {
        const pubkey = opened.pubkey;
        openBox(pubkey, 'backup');
        return;
      }
    }
    for (const pubkey of failures.keys())
      if (!all.accounts.some((a) => a.author.pubkey === pubkey)) failures.delete(pubkey);
    reconcile(
      list,
      cache,
      all.accounts.map(
        (account): AccountRow => ({
          key: account.author.pubkey,
          account,
          active: account.author.pubkey === all.active,
          asking: asking === account.author.pubkey,
          box: opened?.pubkey === account.author.pubkey ? opened.kind : '',
          canKey: able,
          vault,
          locking: locking.has(account.author.pubkey),
          failure: failures.get(account.author.pubkey),
        }),
      ),
      (a) =>
        accountRow(a, env, {
          use: (pubkey) => void act({ a: 'account.use', pubkey }),
          ask: (pubkey) => {
            asking = pubkey;
            draw();
          },
          remove: (row) => void remove(row),
          box: openBox,
          lock: (pubkey) => void lock(pubkey),
        }),
    );
    if (opened) {
      const slot = cache.get(opened.pubkey)?.node.querySelector('.account-box-slot');
      if (slot && opened.handle.el.parentElement !== slot) slot.append(opened.handle.el);
    }
    list.hidden = !all.accounts.length;
    add.sync();
    if (!env.visible.get()) return;
    if (requested && vault && all.accounts.some((a) => a.author.pubkey === requested)) {
      const pubkey = requested;
      requested = undefined;
      if (
        lockedAccount(
          env.engine,
          all.accounts.find((a) => a.author.pubkey === pubkey),
        )
      )
        openBox(pubkey, 'unlock');
    } else if (!opened && able) {
      const fresh = all.accounts.find((a) => isPending(a.author.pubkey));
      if (fresh) openBox(fresh.author.pubkey, 'backup');
    }
  }

  el.classList.add('pad', 'acctv');
  el.tabIndex = -1;
  el.replaceChildren(list, add.el);
  draw();
  const offs = [
    env.engine.accounts.subscribe(draw),
    env.engine.info.subscribe(draw),
    onPending(draw),
    env.visible.subscribe((on) => {
      if (!on) dropBox();
      draw();
    }),
  ];
  return () => {
    disposed = true;
    dropBox();
    add.dispose();
    offs.forEach((off) => off());
    failures.clear();
    locking.clear();
  };
}
