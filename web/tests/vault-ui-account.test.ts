import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import { rememberAccounts, rememberedAccounts } from '../src/shared/face.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountAccount } from '../src/views/account.ts';
import { ability } from '../src/views/can.ts';
import {
  account,
  CIPHER,
  deferred,
  failure,
  fill,
  PASSWORD,
  PUBKEY,
  submit,
  success,
  tick,
  vaultEnv,
} from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const click = (el: HTMLElement, selector: string) =>
  (el.querySelector(selector) as HTMLElement).click();
const choose = (el: HTMLElement) => {
  for (const field of el.querySelectorAll<HTMLInputElement>('.kpassword input'))
    fill(field, PASSWORD);
  submit(el.querySelector<HTMLFormElement>('.kpassword')!);
};

it('opens the requested unlock once, maps errors, and focuses the row when account state precedes success', async () => {
  const x = vaultEnv({ encrypted: true, locked: true });
  saveViewState(x.env.instance, { unlock: PUBKEY });
  const dispose = mountAccount(x.el, x.env);
  try {
    await tick();
    const field = x.el.querySelector<HTMLInputElement>('[data-f="password"]')!;
    expect(document.activeElement).toBe(field);
    expect(ability(x.env.engine)).toBe('locked');
    expect(x.el.querySelector('.asigner')?.textContent).toBe('Locked');
    x.act.mockResolvedValueOnce(failure('rejected'));
    fill(field, 'wrong');
    submit(field.closest('form')!);
    await tick();
    expect(x.el.textContent).toContain('Wrong password.');
    expect(document.activeElement).toBe(field);
    const answer = deferred<ActResult>();
    x.act.mockReturnValueOnce(answer.promise);
    fill(field, PASSWORD);
    submit(field.closest('form')!);
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: false })] });
    answer.resolve(success());
    await tick();
    expect(x.el.querySelector('.kpassword')).toBeNull();
    expect(x.el.querySelector('.asigner')?.textContent).toBe(
      'Key on this device, password-protected',
    );
    expect(document.activeElement).toBe(x.el.querySelector('[data-f="use"]'));
    expect(ability(x.env.engine)).toBe('ok');
    expect(localStorage.getItem('lkjstr:view:keys-fixture')).not.toContain('unlock');
  } finally {
    dispose();
    x.dispose();
  }
});

it.each(['lock', 'remove', 'signer'] as const)(
  'drops a late encrypted backup after account %s',
  async (change) => {
    const x = vaultEnv({ encrypted: true, locked: false });
    const dispose = mountAccount(x.el, x.env);
    try {
      click(x.el, '[data-f="backup"]');
      const answer = deferred<ActResult>();
      x.act.mockReturnValueOnce(answer.promise);
      choose(x.el);
      const fields = [...x.el.querySelectorAll<HTMLInputElement>('.kpassword input')];
      x.accounts.set({
        active: change === 'remove' ? undefined : PUBKEY,
        accounts:
          change === 'remove'
            ? []
            : [
                account(
                  change === 'lock' ? { encrypted: true, locked: true } : { signer: 'remote' },
                ),
              ],
      });
      answer.resolve(success({ encryptedKey: CIPHER }));
      await tick();
      expect(x.el.querySelector('.kfield')).toBeNull();
      expect(x.el.outerHTML).not.toContain(CIPHER);
      expect(fields.every((f) => !f.value)).toBe(true);
      if (change === 'lock')
        expect(x.el.textContent).toContain('Unlock this account to back up its key.');
    } finally {
      dispose();
      x.dispose();
    }
  },
);

it.each(['lock', 'remove'] as const)(
  'drops a pending backup when %s is pressed, before its account status arrives',
  async (action) => {
    const x = vaultEnv({ encrypted: true, locked: false });
    const dispose = mountAccount(x.el, x.env);
    const exported = deferred<ActResult>();
    const revoked = deferred<ActResult>();
    try {
      click(x.el, '[data-f="backup"]');
      x.act.mockReturnValueOnce(exported.promise).mockReturnValueOnce(revoked.promise);
      choose(x.el);
      if (action === 'lock') click(x.el, '[data-f="lock"]');
      else {
        click(x.el, '.ahead [data-f="remove"]');
        click(x.el, '.aask [data-f="remove"]');
      }
      exported.resolve(success({ encryptedKey: CIPHER }));
      await tick();
      expect(x.el.querySelector('.kfield')).toBeNull();
      expect(x.el.outerHTML).not.toContain(CIPHER);
      expect(x.act.mock.calls.at(-1)?.[0].a).toBe(`account.${action}`);
      revoked.resolve(failure('internal'));
      await tick();
      expect(x.el.outerHTML).not.toContain(CIPHER);
    } finally {
      revoked.resolve(success());
      dispose();
      x.dispose();
    }
  },
);

it('drops a late raw key on lock and keeps at most one box', async () => {
  const x = vaultEnv({ encrypted: true, locked: false });
  const dispose = mountAccount(x.el, x.env);
  try {
    click(x.el, '[data-f="backup"]');
    const answer = deferred<ActResult>();
    x.act.mockReturnValueOnce(answer.promise);
    click(x.el, '[data-f="raw"]');
    const raw = x.el.querySelector<HTMLInputElement>('.kfield')!;
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: true })] });
    answer.resolve(success({ key: 'nsec1late-fixture' }));
    await tick();
    expect(raw.value).toBe('');
    click(x.el, '.ahead [data-f="unlock"]');
    expect(x.el.querySelectorAll('.kbox')).toHaveLength(1);
    expect(x.el.querySelector('.kfield')).toBeNull();
    expect(x.el.querySelector('.kpassword')).not.toBeNull();
  } finally {
    dispose();
    x.dispose();
  }
});

it('keeps protect success visible when committed account flags arrive before its final reply', async () => {
  const x = vaultEnv();
  const dispose = mountAccount(x.el, x.env);
  try {
    click(x.el, '[data-f="protect"]');
    const imported = deferred<ActResult>();
    x.act
      .mockResolvedValueOnce(success({ encryptedKey: CIPHER }))
      .mockReturnValueOnce(imported.promise);
    choose(x.el);
    await tick();
    expect(x.act.mock.calls.at(-1)?.[0].a).toBe('account.importEncrypted');
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: false })] });
    imported.resolve(success());
    await tick();
    expect(x.el.querySelector('.kbox')?.textContent).toContain(
      'Protected. This device now asks for the password',
    );
    expect(x.el.querySelector('.asigner')?.textContent).toBe(
      'Key on this device, password-protected',
    );
    expect(x.el.querySelector('.kpassword')).toBeNull();
    expect(x.el.outerHTML).not.toContain(CIPHER);
  } finally {
    dispose();
    x.dispose();
  }
});

it('does not draw protected controls for an older engine and restores protected cached faces locked', () => {
  const x = vaultEnv({ encrypted: true, locked: true }, 5);
  const dispose = mountAccount(x.el, x.env);
  try {
    expect(x.el.querySelector('[data-f="lock"],[data-f="unlock"],[data-f="protect"]')).toBeNull();
    expect(x.el.querySelector('.asigner')?.textContent).toBe('Key on this device');
    rememberAccounts([account({ encrypted: true, locked: false })]);
    expect(rememberedAccounts(PUBKEY)[0]?.locked).toBe(true);
  } finally {
    dispose();
    x.dispose();
  }
});
