import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveViewState } from '../src/shared/view-state.ts';
import { createTopBar } from '../src/ui/topbar.ts';
import { mountAccount } from '../src/views/account.ts';
import { ability, denied } from '../src/views/can.ts';
import { mountCompose } from '../src/views/compose.ts';
import { mountSettings } from '../src/views/settings.ts';
import { account, PUBKEY, tick, vaultEnv } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('shows the closed-lock mark and makes Unlock the first account menu action', () => {
  const x = vaultEnv({ encrypted: true, locked: true });
  const bar = createTopBar(x.el, {
    engine: x.env.engine,
    settings: x.env.settings,
    layer: x.env.layer,
    spaces: document.createElement('div'),
    search() {},
    open: x.open,
  });
  try {
    expect(x.el.querySelector('.acct .i-lock')).not.toBeNull();
    (x.el.querySelector('.acct') as HTMLElement).click();
    const first = x.env.layer.querySelector<HTMLButtonElement>('.menu button')!;
    expect(first.textContent).toBe('Unlock');
    first.click();
    expect(x.open).toHaveBeenLastCalledWith('account', { unlock: PUBKEY });
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: false })] });
    expect(x.el.querySelector('.acct .i-lock')).toBeNull();
  } finally {
    bar.dispose();
    x.dispose();
  }
});

it('routes a denied locked action to the same unlock target', () => {
  const x = vaultEnv({ encrypted: true, locked: true });
  try {
    denied(x.env, 'locked');
    expect(x.env.layer.textContent).toContain('This account is locked. Unlock it to write.');
    const unlock = x.env.layer.querySelector<HTMLElement>('.toast .lnk')!;
    expect(unlock.textContent).toBe('Unlock');
    x.accounts.set({ active: 'b'.repeat(64), accounts: [] });
    unlock.click();
    expect(x.open).toHaveBeenLastCalledWith('account', { unlock: PUBKEY });
  } finally {
    x.dispose();
  }
});

it('redraws a locked composer on unlock without replacing or losing its typed draft', async () => {
  const x = vaultEnv({ encrypted: true, locked: true });
  saveViewState(x.env.instance, { text: 'Draft stays here.' });
  const dispose = mountCompose(x.el, x.env);
  try {
    const field = x.el.querySelector<HTMLTextAreaElement>('.ctext')!;
    expect(field.value).toBe('Draft stays here.');
    expect(x.el.querySelector('.cwho .badge')?.textContent).toBe('Locked');
    const post = x.el.querySelector<HTMLButtonElement>('.cbar > .btn.primary')!;
    expect(post.disabled).toBe(true);
    field.value += ' More words.';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: false })] });
    await tick();
    expect(x.el.querySelector('.ctext')).toBe(field);
    expect(field.value).toBe('Draft stays here. More words.');
    expect(document.activeElement).toBe(field);
    expect(post.disabled).toBe(false);
    expect(x.el.querySelector('.cwho .badge')).toBeNull();
    expect(x.act).not.toHaveBeenCalled();
  } finally {
    dispose();
    x.dispose();
  }
});

it('gates the numeric idle setting until protocol 6 and defaults it to zero', () => {
  const x = vaultEnv({}, 5);
  const dispose = mountSettings(x.el, x.env);
  try {
    const entry = x.el.querySelector<HTMLElement>('[data-entry="lockIdle"]')!;
    expect(entry.hidden).toBe(true);
    x.env.engine.info.set({ engine: 'fixture', version: 6 });
    expect(entry.hidden).toBe(false);
    const input = entry.querySelector<HTMLInputElement>('input')!;
    expect(input.type).toBe('number');
    expect(input.value).toBe('0');
    expect(entry.textContent).toContain('Accounts:');
  } finally {
    dispose();
    x.dispose();
  }
});

it('denies writes from a remembered locked account through the unknown-version handshake', async () => {
  const x = vaultEnv({ encrypted: true, locked: true });
  x.env.engine.info.set(null);
  saveViewState(x.env.instance, { text: 'A startup draft.' });
  const accountEl = document.createElement('div');
  document.body.append(accountEl);
  const disposeAccount = mountAccount(accountEl, x.env);
  const disposeCompose = mountCompose(x.el, x.env);
  try {
    const field = x.el.querySelector<HTMLTextAreaElement>('.ctext')!;
    const post = x.el.querySelector<HTMLButtonElement>('.cbar > .btn.primary')!;
    expect(ability(x.env.engine)).toBe('locked');
    expect(post.disabled).toBe(true);
    expect(x.el.querySelector('.cwho .badge')?.textContent).toBe('Locked');
    expect(
      accountEl.querySelector('[data-f="unlock"],[data-f="lock"],[data-f="protect"]'),
    ).toBeNull();
    denied(x.env, 'locked');
    expect(x.env.layer.querySelector('.toast .lnk')?.textContent).toBe('Accounts');
    x.env.engine.info.set({ engine: 'fixture', version: 5 });
    expect(ability(x.env.engine)).toBe('ok');
    expect(post.disabled).toBe(false);
    expect(x.el.querySelector('.cwho .badge')).toBeNull();
    expect(accountEl.querySelector('[data-f="unlock"]')).toBeNull();
    x.env.engine.info.set({ engine: 'fixture', version: 6 });
    expect(post.disabled).toBe(true);
    expect(x.el.querySelector('.cwho .badge')?.textContent).toBe('Locked');
    expect(accountEl.querySelector('[data-f="unlock"]')).not.toBeNull();
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: false })] });
    await tick();
    expect(post.disabled).toBe(false);
    expect(x.el.querySelector('.ctext')).toBe(field);
    expect(field.value).toBe('A startup draft.');
    expect(x.act).not.toHaveBeenCalled();
  } finally {
    disposeAccount();
    disposeCompose();
    accountEl.remove();
    x.dispose();
  }
});
