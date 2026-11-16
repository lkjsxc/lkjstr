// The backup box retains ciphertext only while open; raw key access starts folded.
import type { Pubkey } from '../engine/protocol.ts';
import { h } from '../shared/h.ts';
import { t } from '../shared/i18n.ts';
import { createSignal } from '../shared/signal.ts';
import { passwordForm } from './account-password.ts';
import { rawKeyPart } from './account-raw-key.ts';
import { type AccountBox, canVault, lockedAccount } from './account-vault.ts';
import { toast } from './parts.ts';
import type { ViewEnv } from './registry.ts';

const pending = createSignal<Pubkey | undefined>(undefined);
let creating = false;
export const backupPending = (): boolean => creating || pending.get() !== undefined;
export const isPending = (pubkey: Pubkey): boolean => pending.get() === pubkey;
export const onPending = pending.subscribe;
export const creatingAccount = (on: boolean): void => void (creating = on);
export const markCreated = (pubkey: Pubkey): void => pending.set(pubkey);
export const forget = (pubkey: Pubkey): void => {
  if (pending.get() === pubkey) pending.set(undefined);
};
export const canKey = (env: ViewEnv): boolean => (env.engine.info.get()?.version ?? 0) >= 2;

export function keyBox(
  env: ViewEnv,
  pubkey: Pubkey,
  close: () => void,
  unlock: () => void,
): AccountBox {
  const fresh = isPending(pubkey);
  const account = env.engine.accounts.get().accounts.find((a) => a.author.pubkey === pubkey);
  const el = h('div', { class: 'kbox' });
  let raw: AccountBox | undefined;
  let password: AccountBox | undefined;
  let ciphertext: HTMLInputElement | undefined;
  let disposed = false;
  const urls = new Set<string>(); // bound: downloads whose next-task revocation is pending
  const done = h(
    'button',
    {
      class: fresh ? 'btn primary' : 'btn',
      'data-f': 'done',
      onclick: () => {
        forget(pubkey);
        close();
      },
    },
    t(fresh ? 'account.key.saved' : 'account.key.done'),
  );
  const fold = (): void => {
    raw?.dispose();
    raw = undefined;
    rawHost.replaceChildren();
    rawToggle.setAttribute('aria-expanded', 'false');
  };
  const rawHost = h('div');
  const rawToggle = h(
    'button',
    {
      class: 'amore',
      'data-f': 'raw',
      'aria-expanded': false,
      onclick: () => {
        if (raw) return fold();
        raw = rawKeyPart(env, pubkey, fold);
        rawHost.replaceChildren(h('div', { class: 'kwarn' }, t('account.raw.warn')), raw.el);
        rawToggle.setAttribute('aria-expanded', 'true');
      },
    },
    t('account.raw.open'),
  );
  if (lockedAccount(env.engine, account)) {
    el.append(
      h('div', { class: 'kwarn muted' }, t('account.unlockFirst')),
      h('button', { class: 'btn', onclick: unlock }, t('account.unlock')),
    );
  } else if (!canVault(env.engine)) {
    raw = rawKeyPart(env, pubkey, close);
    el.append(raw.el, h('div', { class: 'krow' }, done));
  } else {
    const copyHost = h('div');
    password = passwordForm({
      kind: 'choose',
      submit: 'account.copy.make',
      busy: 'account.copy.busy',
      send: async (password) => {
        const answer = env.engine.act({ a: 'account.exportEncrypted', pubkey, password });
        password = '';
        const r = await answer;
        return r.ok && !r.encryptedKey
          ? { t: 'result', req: r.req, ok: false, error: { code: 'internal' } }
          : r;
      },
      success: (r) => {
        if (disposed) return;
        // The successful capability always returns ciphertext. An absent value is no backup.
        if (!r.encryptedKey) return;
        password?.dispose();
        password = undefined;
        ciphertext = h('input', {
          class: 'kfield',
          type: 'text',
          readonly: true,
          autocomplete: 'off',
          spellcheck: 'false',
          'aria-label': t('account.copy.label'),
          value: r.encryptedKey,
          onfocus: () => ciphertext?.select(),
        });
        const copy = h(
          'button',
          {
            class: 'btn',
            'data-f': 'copy-encrypted',
            onclick: () => {
              if (!disposed && ciphertext?.value)
                void navigator.clipboard.writeText(ciphertext.value).then(
                  () => toast(env.layer, t('copied')),
                  () => toast(env.layer, t('copyFailed')),
                );
            },
          },
          t('account.key.copy'),
        );
        const save = h(
          'button',
          {
            class: 'btn',
            'data-f': 'save-encrypted',
            onclick: () => {
              if (disposed || !ciphertext?.value) return;
              const url = URL.createObjectURL(new Blob([ciphertext.value], { type: 'text/plain' }));
              urls.add(url);
              const link = h('a', {
                href: url,
                download: `lkjstr-${account?.author.npub.slice(5, 13) ?? ''}.ncryptsec.txt`,
              });
              link.click();
              setTimeout(() => (URL.revokeObjectURL(url), urls.delete(url)), 0);
            },
          },
          t('account.copy.save'),
        );
        copyHost.replaceChildren(
          h('label', { class: 'klabel' }, t('account.copy.label'), ciphertext),
          h('div', { class: 'krow' }, copy, save),
          h('div', { class: 'asaid muted' }, t('account.copy.how')),
        );
      },
    });
    copyHost.append(password.el);
    el.append(
      h('div', { class: 'ktitle' }, t('account.copy.title')),
      copyHost,
      h('div', { class: 'kdivider' }, rawToggle, rawHost),
      h('div', { class: 'krow' }, done),
    );
  }
  return {
    el,
    focus: () => password?.focus?.(),
    dispose() {
      disposed = true;
      password?.dispose();
      fold();
      if (ciphertext) ciphertext.value = '';
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
