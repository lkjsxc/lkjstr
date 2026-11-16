import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import { saveViewState } from '../src/shared/view-state.ts';
import { mountAccount } from '../src/views/account.ts';
import { mountAdd } from '../src/views/account-add.ts';
import {
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function setup(version = 6) {
  const x = vaultEnv({}, version);
  const add = mountAdd(x.env);
  x.el.append(add.el);
  (x.el.querySelector('[data-f="other"]') as HTMLElement).click();
  const key = x.el.querySelector<HTMLInputElement>('[name="lkjstr-key"]')!;
  const start = async () => {
    fill(key, CIPHER);
    submit(key.closest('form')!);
    await tick();
    return x.el.querySelector<HTMLInputElement>('[data-f="password"]')!;
  };
  return {
    ...x,
    add,
    key,
    start,
    clean: () => {
      add.dispose();
      x.dispose();
    },
  };
}

it('keeps encrypted sign-in text out of fields/storage, retries only the password, and closes on success', async () => {
  const x = setup();
  try {
    const password = await x.start();
    expect(x.key.value).toBe('');
    expect(password.autocomplete).toBe('current-password');
    expect(document.activeElement).toBe(password);
    expect(x.act).not.toHaveBeenCalled();
    const pending = deferred<ActResult>();
    x.act.mockReturnValueOnce(pending.promise);
    fill(password, PASSWORD);
    submit(password.closest('form')!);
    expect(password.value).toBe('');
    expect(x.act).toHaveBeenLastCalledWith({
      a: 'account.importEncrypted',
      key: CIPHER,
      password: PASSWORD,
    });
    expect(x.el.textContent).toContain('Unlocking');
    expect(JSON.stringify(localStorage)).not.toContain(PASSWORD);
    expect(x.el.outerHTML).not.toContain(CIPHER);
    pending.resolve(failure('rejected'));
    await tick();
    expect(x.el.textContent).toContain('Wrong password, or this key text is damaged.');
    expect(document.activeElement).toBe(password);
    x.act.mockResolvedValueOnce(success());
    fill(password, 'retry password');
    submit(password.closest('form')!);
    await tick();
    expect(x.act).toHaveBeenLastCalledWith({
      a: 'account.importEncrypted',
      key: CIPHER,
      password: 'retry password',
    });
    expect(x.close).toHaveBeenCalledOnce();
    expect(x.el.querySelector('[data-f="password"]')).toBeNull();
  } finally {
    x.clean();
  }
});

it('drops the step on Cancel or leaving the tab; a late failure cannot restore it', async () => {
  const x = setup();
  try {
    let password = await x.start();
    fill(password, PASSWORD);
    const answer = deferred<ActResult>();
    x.act.mockReturnValueOnce(answer.promise);
    submit(password.closest('form')!);
    x.visible.set(false);
    answer.resolve(failure('rejected'));
    await tick();
    expect(x.el.querySelector('[data-f="password"]')).toBeNull();
    expect(x.key.closest('form')?.hidden).toBe(false);
    expect(x.el.textContent).not.toContain('Wrong password');
    x.visible.set(true);
    password = await x.start();
    fill(password, 'unsent password');
    (password.closest('form')!.querySelector('[type="button"]') as HTMLElement).click();
    expect(password.value).toBe('');
    expect(x.el.querySelector('[data-f="password"]')).toBeNull();
    expect(document.activeElement).toBe(x.key);
  } finally {
    x.clean();
  }
});

it('forgets the ciphertext after a hidden minute, including a suspended timer checked on wake', async () => {
  vi.useFakeTimers();
  const x = setup();
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  try {
    const password = await x.start();
    fill(password, 'never sent');
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(password.value).toBe('');
    vi.setSystemTime(Date.now() + 61_000);
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(x.el.querySelector('[data-f="password"]')).toBeNull();
    expect(x.act).not.toHaveBeenCalled();
  } finally {
    x.clean();
  }
});

it('does not show or send the protected-key flow to protocol 5', async () => {
  const x = setup(5);
  try {
    await x.start();
    expect(x.el.querySelector('[data-f="password"]')).toBeNull();
    expect(x.act).toHaveBeenLastCalledWith({ a: 'account.add', how: 'key', key: CIPHER });
  } finally {
    x.clean();
  }
});

it('signs in an existing encrypted key with an empty password when requested', async () => {
  const x = setup();
  try {
    const field = await x.start();
    const form = field.closest('form')!;
    expect(form.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
    submit(form);
    await tick();
    expect(x.act).toHaveBeenCalledWith({ a: 'account.importEncrypted', key: CIPHER, password: '' });
    expect(x.close).toHaveBeenCalledOnce();
  } finally {
    x.clean();
  }
});

it('unlocks an existing empty-password key without imposing a new-password strength rule', async () => {
  const x = vaultEnv({ encrypted: true, locked: true });
  saveViewState(x.env.instance, { unlock: PUBKEY });
  const dispose = mountAccount(x.el, x.env);
  try {
    const form = x.el.querySelector<HTMLFormElement>('.kpassword')!;
    expect(form.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled).toBe(false);
    submit(form);
    await tick();
    expect(x.act).toHaveBeenCalledWith({ a: 'account.unlock', pubkey: PUBKEY, password: '' });
    expect(x.el.querySelector('.kpassword')).toBeNull();
  } finally {
    dispose();
    x.dispose();
  }
});
