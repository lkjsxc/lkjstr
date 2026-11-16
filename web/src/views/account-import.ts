// The imported ciphertext exists only for this password step, never in tab state.
import { h } from '../shared/h.ts';
import { passwordForm } from './account-password.ts';
import { type AccountBox, canVault } from './account-vault.ts';
import type { ViewEnv } from './registry.ts';

export function encryptedImport(env: ViewEnv, restore: () => void) {
  const el = h('div', { hidden: true });
  let key = '';
  let form: AccountBox | undefined;
  let hiddenAt: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const clear = (back = true): void => {
    const active = !!form;
    key = '';
    form?.dispose();
    form = undefined;
    el.replaceChildren();
    el.hidden = true;
    clearTimeout(timer);
    hiddenAt = undefined;
    if (back && active && !disposed) restore();
  };
  const visibility = (): void => {
    if (!form) return;
    if (document.hidden) {
      hiddenAt ??= Date.now();
      clearTimeout(timer);
      timer = setTimeout(clear, 60_000);
    } else {
      clearTimeout(timer);
      if (hiddenAt !== undefined && Date.now() - hiddenAt >= 60_000) clear();
      hiddenAt = undefined;
    }
  };
  const off = env.visible.subscribe((on) => {
    if (!on) clear();
  });
  document.addEventListener('visibilitychange', visibility);
  return {
    el,
    active: () => !!form,
    cancel: () => clear(),
    start(encrypted: string): void {
      clear(false);
      key = encrypted;
      form = passwordForm({
        kind: 'import',
        submit: 'account.import.submit',
        busy: 'account.busy.unlock',
        hint: 'account.import.hint',
        cancel: () => clear(),
        send: (password) => env.engine.act({ a: 'account.importEncrypted', key, password }),
        success: () => {
          clear(false);
          env.close();
        },
      });
      el.hidden = false;
      el.replaceChildren(form.el);
      queueMicrotask(() => form?.focus?.());
      visibility();
    },
    sync(): void {
      if (!canVault(env.engine)) clear();
    },
    dispose(): void {
      disposed = true;
      clear(false);
      off();
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
