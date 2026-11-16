// A password is held by its field until submission. No view state or draft storage sees it.
import type { ActResult } from '../engine/client.ts';
import { h } from '../shared/h.ts';
import { type Key, t } from '../shared/i18n.ts';
import { type AccountBox, vaultFailure } from './account-vault.ts';

type Options = {
  kind: 'unlock' | 'import' | 'choose';
  submit: Key;
  busy: Key;
  hint?: Key;
  warning?: Key;
  failed?: Key;
  errorKind?: 'unlock' | 'import' | 'choose';
  cancel?(): void;
  send(password: string, alive: () => boolean): Promise<ActResult>;
  success(result: ActResult): void;
};

export function passwordForm(o: Options): AccountBox {
  let disposed = false;
  let busy = false;
  const chosen = o.kind === 'choose';
  const valid = (): boolean =>
    !chosen || (Array.from(first.value).length >= 8 && first.value === again.value);
  const sync = (): void => {
    first.disabled = again.disabled = busy;
    submit.disabled = busy || !valid();
    form.setAttribute('aria-busy', String(busy));
  };
  const change = (): void => {
    hint.textContent = '';
    first.removeAttribute('aria-invalid');
    again.removeAttribute('aria-invalid');
    sync();
  };
  const input = (name: Key, repeat = false): HTMLInputElement =>
    h('input', {
      type: 'password',
      autocomplete: chosen ? 'new-password' : 'current-password',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': t(name),
      'data-f': repeat ? 'password-again' : 'password',
      oninput: change,
    });
  const first = input(o.kind === 'import' ? 'account.import.password' : 'account.password');
  const again = input('account.password.again', true);
  const hint = h('div', { class: 'asaid muted' });
  again.addEventListener('blur', () => {
    if (busy || disposed) return;
    hint.textContent =
      Array.from(first.value).length < 8 || Array.from(again.value).length < 8
        ? t('account.password.short')
        : first.value !== again.value
          ? t('account.password.mismatch')
          : '';
  });
  const said = h('div', { class: 'asaid', role: 'status' });
  const submit = h(
    'button',
    { class: 'btn primary', type: 'submit', 'data-f': 'password-submit' },
    t(o.submit),
  );
  const clear = (): void => {
    first.value = again.value = '';
    sync();
  };
  const focus = (): void => {
    if (!disposed && first.isConnected && !document.hidden) first.focus({ preventScroll: true });
  };
  const run = async (): Promise<void> => {
    if (disposed || busy || !valid()) return;
    let password = first.value;
    clear();
    busy = true;
    sync();
    hint.textContent = '';
    said.className = 'asaid muted';
    said.setAttribute('role', 'status');
    said.textContent = t(o.busy);
    let result: ActResult;
    try {
      const answer = o.send(password, () => !disposed);
      password = '';
      result = await answer;
    } catch {
      result = { t: 'result', req: '', ok: false, error: { code: 'internal' } };
    } finally {
      password = '';
    }
    if (disposed) return;
    busy = false;
    sync();
    if (result.ok) return o.success(result);
    said.className = 'asaid error';
    said.setAttribute('role', 'alert');
    said.replaceChildren(
      ...(o.failed ? [h('div', null, t(o.failed))] : []),
      h('div', null, t(vaultFailure(result.error?.code, o.errorKind ?? o.kind))),
    );
    first.setAttribute('aria-invalid', 'true');
    focus();
  };
  const label = (name: Key, field: HTMLInputElement): HTMLElement =>
    h('label', { class: 'klabel' }, t(name), field);
  const form = h(
    'form',
    {
      class: 'kpassword',
      onsubmit: (e) => {
        e.preventDefault();
        void run();
      },
    },
    o.warning ? h('div', { class: 'kwarn' }, t(o.warning)) : null,
    label(o.kind === 'import' ? 'account.import.password' : 'account.password', first),
    chosen ? label('account.password.again', again) : null,
    chosen ? hint : null,
    o.hint ? h('div', { class: 'asaid muted' }, t(o.hint)) : null,
    h(
      'div',
      { class: 'krow' },
      submit,
      o.cancel
        ? h('button', { class: 'btn', type: 'button', onclick: o.cancel }, t('account.cancel'))
        : null,
    ),
    said,
  );
  const hidden = (): void => {
    if (document.hidden) clear();
  };
  document.addEventListener('visibilitychange', hidden);
  sync();
  return {
    el: form,
    focus,
    dispose() {
      disposed = true;
      clear();
      document.removeEventListener('visibilitychange', hidden);
    },
  };
}
