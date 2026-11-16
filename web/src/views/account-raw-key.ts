// Raw key access is explicit, scoped to the unfolded backup part, and forgotten on teardown.
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import type { AccountBox } from './account-vault.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

export function rawKeyPart(env: ViewEnv, pubkey: string, fold: () => void): AccountBox {
  let disposed = false;
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
  const show = h(
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
      onclick: () => {
        if (!disposed && field.value)
          void navigator.clipboard.writeText(field.value).then(
            () => toast(env.layer, t('copied')),
            () => toast(env.layer, t('copyFailed')),
          );
      },
    },
    t('account.key.copy'),
  );
  const said = h('div', { class: 'kwarn muted' }, t('account.key.warn'));
  const hidden = (): void => {
    if (document.hidden) {
      hide();
      field.value = '';
      fold();
    }
  };
  document.addEventListener('visibilitychange', hidden);
  void env.engine.act({ a: 'account.key', pubkey }).then((r) => {
    if (disposed) return;
    if (!r.ok || !r.key) {
      said.className = 'kwarn error';
      said.setAttribute('role', 'alert');
      said.textContent = t('account.key.failed');
      return;
    }
    field.value = r.key;
    show.disabled = copy.disabled = false;
  });
  return {
    el: h('div', null, said, h('div', { class: 'krow' }, field, show, copy)),
    dispose() {
      disposed = true;
      hide();
      field.value = '';
      show.disabled = copy.disabled = true;
      document.removeEventListener('visibilitychange', hidden);
    },
  };
}
