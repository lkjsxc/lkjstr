// Explicit migration: export first, then authenticated import; never remove the saved account.
import type { ActResult } from '../engine/client.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { passwordForm } from './account-password.ts';
import type { AccountBox } from './account-vault.ts';
import type { ViewEnv } from './registry.ts';

export function protectBox(
  env: ViewEnv,
  pubkey: string,
  close: () => void,
  backup: () => void,
  changed: () => void,
): AccountBox {
  const el = h('div', { class: 'kbox' });
  let retainedPassword = '';
  const form = passwordForm({
    kind: 'choose',
    submit: 'account.protect.submit',
    busy: 'account.busy.protect',
    warning: 'account.protect.warn',
    failed: 'account.protect.failed',
    errorKind: 'import',
    cancel: close,
    send: async (password, alive) => {
      retainedPassword = password;
      password = '';
      let key = '';
      let exported: ActResult | undefined;
      try {
        exported = await env.engine.act({
          a: 'account.exportEncrypted',
          pubkey,
          password: retainedPassword,
        });
        if (!exported.ok) return exported;
        if (!alive()) return { t: 'result', req: '', ok: false };
        key = exported.encryptedKey ?? '';
        exported = undefined;
        if (!key) return { t: 'result', req: '', ok: false, error: { code: 'internal' } };
        const answer = env.engine.act({
          a: 'account.importEncrypted',
          key,
          password: retainedPassword,
        });
        key = retainedPassword = '';
        return await answer;
      } finally {
        key = retainedPassword = '';
        exported = undefined;
      }
    },
    success: () => {
      form.dispose();
      el.replaceChildren(
        h('div', { class: 'kwarn' }, t('account.protect.done')),
        h(
          'div',
          { class: 'krow' },
          h('button', { class: 'btn', onclick: backup }, t('account.backup')),
          h('button', { class: 'btn', onclick: close }, t('account.key.done')),
        ),
      );
      changed();
    },
  });
  el.append(form.el);
  return {
    el,
    focus: form.focus,
    dispose() {
      retainedPassword = '';
      form.dispose();
    },
  };
}
