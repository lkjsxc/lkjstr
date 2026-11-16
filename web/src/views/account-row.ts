// Account row structure is shared by ordinary, protected and locked local keys.
import type { Account } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { icon } from '../shared/icons.ts';
import { lockedAccount, protectedAccount, signerLabel } from './account-vault.ts';
import { displayName, faceButton, how, plainName, shortNpub, unnamed } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export type AccountRow = {
  key: string;
  account: Account;
  active: boolean;
  asking: boolean;
  box: string;
  canKey: boolean;
  vault: boolean;
  locking: boolean;
  failure?: Key;
};
type Controls = {
  use(pubkey: string): void;
  ask(pubkey: string): void;
  remove(row: AccountRow): void;
  box(pubkey: string, kind: 'backup' | 'unlock' | 'protect'): void;
  lock(pubkey: string): void;
};

export function accountRow(a: AccountRow, env: ViewEnv, c: Controls): HTMLElement {
  const name = plainName(a.account.author);
  const { author, signer } = a.account;
  const protectedKey = protectedAccount(env.engine, a.account);
  const locked = lockedAccount(env.engine, a.account);
  const button = (name: Key, id: string, run: () => void, disabled = false) =>
    h('button', { class: 'btn', 'data-f': id, onclick: run, disabled }, t(name));
  const main = h(
    'button',
    {
      class: 'amain',
      'data-f': 'use',
      'aria-current': a.active ? 'true' : null,
      title: a.active ? t('account.active') : t('account.use', { name }),
      onclick: () => {
        if (!a.active) c.use(a.key);
      },
    },
    h(
      'span',
      { class: 'awho' },
      h('b', { class: 'clip' }, displayName(author)),
      h(
        'span',
        { class: 'muted clip' },
        h(
          'span',
          { class: signer === 'none' ? 'badge warn' : 'asigner' },
          t(signerLabel(env.engine, a.account)),
        ),
        unnamed(author) ? null : ` ${shortNpub(author)}`,
      ),
    ),
    a.active ? icon('check') : null,
  );
  const drop = button('account.remove', 'remove', () => {
    if (signer === 'local' || signer === 'remote') c.ask(a.key);
    else c.remove(a);
  });
  drop.title = t('account.removeOf', { name });
  const profile = button('view.profile', 'profile', () => {});
  profile.addEventListener('click', (e) =>
    env.open('profile', { pubkey: a.key, title: name }, how(e as MouseEvent)),
  );
  const confirm = a.asking
    ? h(
        'div',
        { class: 'aask', role: 'alert' },
        h('span', null, t(signer === 'remote' ? 'account.remove.remote' : 'account.remove.local')),
        h(
          'span',
          { class: 'abtns' },
          h(
            'button',
            { class: 'btn danger', 'data-f': 'remove', onclick: () => c.remove(a) },
            t('account.remove'),
          ),
          button('account.cancel', 'cancel', () => c.ask('')),
        ),
      )
    : null;
  return h(
    'div',
    { class: a.active ? 'arow on' : 'arow' },
    h(
      'div',
      { class: 'ahead' },
      h('div', { class: 'aidentity' }, faceButton(author, env), main),
      a.asking
        ? null
        : h(
            'span',
            { class: 'abtns' },
            profile,
            protectedKey
              ? button(
                  locked ? 'account.unlock' : 'account.lock',
                  locked ? 'unlock' : 'lock',
                  () => (locked ? c.box(a.key, 'unlock') : c.lock(a.key)),
                  a.locking,
                )
              : null,
            signer === 'local' && a.canKey && a.box !== 'backup'
              ? button('account.backup', 'backup', () => c.box(a.key, 'backup'))
              : null,
            signer === 'local' && a.vault && !protectedKey && a.box !== 'protect'
              ? button('account.protect', 'protect', () => c.box(a.key, 'protect'))
              : null,
            drop,
          ),
    ),
    confirm,
    a.failure ? h('div', { class: 'asaid error', role: 'alert' }, t(a.failure)) : null,
    h('div', { class: 'account-box-slot' }),
  );
}
