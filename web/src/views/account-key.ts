// The one place a secret key is ever shown: the box under a local account, opened by "Back up key" and once by
// itself right after an account is created. The key is asked from the engine when the box opens, sits in a masked
// field while it is open and is dropped when it closes. It is never stored, logged or put into a message.
import type { Pubkey } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { createSignal } from '../shared/signal.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

// A created account whose key the reader has not yet said they saved (and, before the engine has answered, the
// fact that one is being made). Kept in memory only: it names an account, never a key.
const pending = createSignal<Pubkey | undefined>(undefined);
let creating = false;
/** A key still has to be saved: its tab comes along when the layout changes around it. */
export const backupPending = (): boolean => creating || pending.get() !== undefined;
export const isPending = (pubkey: Pubkey): boolean => pending.get() === pubkey;
export const onPending = pending.subscribe;
export const creatingAccount = (on: boolean): void => void (creating = on);
export const markCreated = (pubkey: Pubkey): void => pending.set(pubkey);
export const forget = (pubkey: Pubkey): void => {
  if (pending.get() === pubkey) pending.set(undefined);
};

/** An engine that cannot hand a key back (protocol 1) is never asked to make one. */
export const canKey = (env: ViewEnv): boolean => (env.engine.info.get()?.version ?? 0) >= 2;

export function keyBox(env: ViewEnv, pubkey: Pubkey, close: () => void): HTMLElement {
  const fresh = isPending(pubkey);
  const field = h('input', {
    type: 'password',
    readonly: true,
    class: 'kfield',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': t('account.key'),
    placeholder: '…',
  });
  const hide = (): void => {
    field.type = 'password';
    show.textContent = t('account.key.show');
    show.setAttribute('aria-pressed', 'false');
  };
  const show: HTMLElement = h(
    'button',
    {
      class: 'btn',
      'data-f': 'show',
      'aria-pressed': false,
      disabled: true,
      onclick: () => {
        if (field.type === 'text') return hide();
        field.type = 'text';
        show.textContent = t('account.key.hide');
        show.setAttribute('aria-pressed', 'true');
      },
    },
    t('account.key.show'),
  );
  const copy = h(
    'button',
    {
      class: 'btn',
      'data-f': 'copy',
      disabled: true,
      onclick: () =>
        void navigator.clipboard.writeText(field.value).then(
          () => toast(env.layer, t('copied')),
          () => toast(env.layer, t('copyFailed')),
        ),
    },
    t('account.key.copy'),
  );
  const done = h(
    'button',
    {
      class: fresh ? 'btn primary' : 'btn',
      'data-f': 'done',
      onclick: () => {
        field.value = '';
        document.removeEventListener('visibilitychange', hide);
        forget(pubkey);
        close();
      },
    },
    t(fresh ? 'account.key.saved' : 'account.key.done'),
  );
  const said = h('div', { class: fresh ? 'kwarn' : 'kwarn muted' }, t('account.key.warn'));
  // The key is covered again whenever the page is not being looked at.
  document.addEventListener('visibilitychange', hide);
  void env.engine.act({ a: 'account.key', pubkey }).then((r) => {
    if (!r.ok || !r.key) {
      said.className = 'kwarn error';
      said.setAttribute('role', 'alert');
      said.textContent = t('account.key.failed');
      return;
    }
    field.value = r.key;
    show.removeAttribute('disabled');
    copy.removeAttribute('disabled');
  });
  return h('div', { class: 'kbox' }, said, h('div', { class: 'krow' }, field, show, copy, done));
}
