// The Accounts tab: who is on this device, which one is in use, and the ways to add another. Signed out it is the
// sign-in surface: the same three ways and nothing else. A press on an account switches to it; removing one that
// holds a key (or a signer connection) asks first, because that cannot be taken back; the others go at once with
// an Undo.
import type { Account } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { mountAdd } from './account-add.ts';
import { canKey, forget, isPending, keyBox, onPending } from './account-key.ts';
import { type Keyed, reconcile } from './lists.ts';
import { displayName, faceButton, how, plainName, shortNpub, toast, unnamed } from './parts.ts';
import type { ViewEnv } from './registry.ts';

type RowModel = {
  readonly key: string;
  readonly author: Account['author'];
  readonly signer: Account['signer'];
  readonly active: boolean;
  readonly asking: boolean;
  readonly keyOpen: boolean;
  readonly canKey: boolean;
};

export function mountAccount(el: HTMLElement, env: ViewEnv): () => void {
  const list = h('div', { class: 'alist' });
  const cache: Keyed = new Map(); // bound: the accounts on this device (at most 32)
  const boxes = new Map<string, HTMLElement>(); // bound: open key boxes, one per local account
  let asking = ''; // the account whose removal is being confirmed
  const add = mountAdd(env);

  const act = async (action: Parameters<ViewEnv['engine']['act']>[0]): Promise<boolean> => {
    const r = await env.engine.act(action);
    if (!r.ok) toast(env.layer, t(`error.${r.error?.code ?? 'internal'}` as Key));
    return r.ok;
  };
  const closeKey = (pubkey: string): void => {
    boxes.delete(pubkey);
    draw();
  };
  const openKey = (pubkey: string): void => {
    if (!boxes.has(pubkey))
      boxes.set(
        pubkey,
        keyBox(env, pubkey, () => closeKey(pubkey)),
      );
    draw();
  };
  const remove = async (a: RowModel): Promise<void> => {
    asking = '';
    const name = plainName(a.author);
    if (!(await act({ a: 'account.remove', pubkey: a.key }))) return;
    boxes.delete(a.key);
    forget(a.key);
    // Only what can be had again without the reader's secret is offered back.
    const again =
      a.signer === 'none'
        ? () => void act({ a: 'account.add', how: 'key', key: a.author.npub })
        : a.signer === 'extension'
          ? () => void act({ a: 'account.add', how: 'extension' })
          : undefined;
    toast(env.layer, t('account.removed', { name }), again);
  };

  const row = (a: RowModel): HTMLElement => {
    const name = plainName(a.author);
    const main = h(
      'button',
      {
        class: 'amain',
        'data-f': 'use',
        'aria-current': a.active ? 'true' : null,
        title: a.active ? t('account.active') : t('account.use', { name }),
        onclick: () => void (a.active || act({ a: 'account.use', pubkey: a.key })),
      },
      h(
        'span',
        { class: 'awho' },
        h('b', { class: 'clip' }, displayName(a.author)),
        h(
          'span',
          { class: 'muted clip' },
          h(
            'span',
            { class: a.signer === 'none' ? 'badge warn' : 'asigner' },
            t(`account.signer.${a.signer}`),
          ),
          // Someone whose name is not known yet is already named by their key, once.
          unnamed(a.author) ? null : ` ${shortNpub(a.author)}`,
        ),
      ),
      a.active ? icon('check') : null,
    );
    const guarded = a.signer === 'local' || a.signer === 'remote';
    const drop = h(
      'button',
      {
        class: 'btn',
        'data-f': 'remove',
        title: t('account.removeOf', { name }),
        onclick: () => {
          if (!guarded) return void remove(a);
          asking = a.key;
          draw();
        },
      },
      t('account.remove'),
    );
    const backup =
      a.signer === 'local' && a.canKey && !a.keyOpen
        ? h(
            'button',
            { class: 'btn', 'data-f': 'backup', onclick: () => openKey(a.key) },
            t('account.backup'),
          )
        : null;
    const profile = h(
      'button',
      {
        class: 'btn',
        'data-f': 'profile',
        onclick: (e) => env.open('profile', { pubkey: a.key, title: name }, how(e as MouseEvent)),
      },
      t('view.profile'),
    );
    const confirm = a.asking
      ? h(
          'div',
          { class: 'aask', role: 'alert' },
          h(
            'span',
            null,
            t(a.signer === 'remote' ? 'account.remove.remote' : 'account.remove.local'),
          ),
          h(
            'span',
            { class: 'abtns' },
            h(
              'button',
              { class: 'btn danger', 'data-f': 'remove', onclick: () => void remove(a) },
              t('account.remove'),
            ),
            h(
              'button',
              {
                class: 'btn',
                'data-f': 'cancel',
                onclick: () => {
                  asking = '';
                  draw();
                },
              },
              t('account.cancel'),
            ),
          ),
        )
      : null;
    return h(
      'div',
      { class: a.active ? 'arow on' : 'arow' },
      h(
        'div',
        { class: 'ahead' },
        h('div', { class: 'aidentity' }, faceButton(a.author, env), main),
        a.asking ? null : h('span', { class: 'abtns' }, profile, backup, drop),
      ),
      confirm,
      a.keyOpen ? (boxes.get(a.key) ?? null) : null,
    );
  };

  function draw(): void {
    const a = env.engine.accounts.get();
    const able = canKey(env);
    // A created account opens on its key: it is not left without one.
    for (const x of a.accounts)
      if (isPending(x.author.pubkey) && able && !boxes.has(x.author.pubkey))
        boxes.set(
          x.author.pubkey,
          keyBox(env, x.author.pubkey, () => closeKey(x.author.pubkey)),
        );
    reconcile(
      list,
      cache,
      a.accounts.map(
        (x): RowModel => ({
          key: x.author.pubkey,
          author: x.author,
          signer: x.signer,
          active: x.author.pubkey === a.active,
          asking: asking === x.author.pubkey,
          keyOpen: boxes.has(x.author.pubkey),
          canKey: able,
        }),
      ),
      row,
    );
    list.hidden = a.accounts.length === 0;
    add.sync();
  }

  el.classList.add('pad', 'acctv');
  el.tabIndex = -1;
  el.replaceChildren(list, add.el);
  draw();
  const offs = [
    env.engine.accounts.subscribe(draw),
    env.engine.info.subscribe(draw),
    onPending(draw),
  ];
  return () => offs.forEach((off) => off());
}
