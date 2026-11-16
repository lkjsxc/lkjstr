import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import { keyBox } from '../src/views/account-key.ts';
import { protectBox } from '../src/views/account-protect.ts';
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
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const fields = (el: HTMLElement) => [
  ...el.querySelectorAll<HTMLInputElement>('input[type="password"]'),
];
const choose = (el: HTMLElement, password = PASSWORD) => {
  const [first, again] = fields(el);
  fill(first!, password);
  fill(again!, password);
  submit(first!.closest('form')!);
};

it('opens backup on a neutral protected-copy form; exports only after matching eight-character passwords', async () => {
  const x = vaultEnv();
  const box = keyBox(x.env, PUBKEY, vi.fn(), vi.fn());
  x.el.append(box.el);
  try {
    expect(x.act).not.toHaveBeenCalled();
    expect(x.el.querySelector('[data-f="show"]')).toBeNull();
    const [first, again] = fields(x.el);
    const button = x.el.querySelector<HTMLButtonElement>('[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(first?.autocomplete).toBe('new-password');
    fill(first!, 'short');
    fill(again!, 'short');
    again?.dispatchEvent(new FocusEvent('blur'));
    expect(x.el.textContent).toContain('Use at least 8 characters.');
    fill(first!, PASSWORD);
    fill(again!, 'different password');
    again?.dispatchEvent(new FocusEvent('blur'));
    expect(x.el.textContent).toContain('The two passwords differ.');
    expect(button.disabled).toBe(true);
    const answer = deferred<ActResult>();
    x.act.mockReturnValueOnce(answer.promise);
    choose(x.el);
    expect(fields(x.el).every((f) => !f.value)).toBe(true);
    expect(x.act).toHaveBeenLastCalledWith({
      a: 'account.exportEncrypted',
      pubkey: PUBKEY,
      password: PASSWORD,
    });
    expect(x.el.textContent).toContain('Making the copy');
    answer.resolve(success({ encryptedKey: CIPHER }));
    await tick();
    const copy = x.el.querySelector<HTMLInputElement>('.kfield')!;
    expect(copy.readOnly).toBe(true);
    expect(copy.type).toBe('text');
    expect(copy.value).toBe(CIPHER);
    expect(x.el.textContent).toContain('Protected key (ncryptsec)');
    expect(fields(x.el)).toHaveLength(0);
    expect(JSON.stringify(localStorage)).not.toContain(CIPHER);
    box.dispose();
    expect(copy.value).toBe('');
  } finally {
    box.dispose();
    x.dispose();
  }
});

it('uses the specified filename and only requests a raw key after unfolding, dropping late replies', async () => {
  const x = vaultEnv();
  const box = keyBox(x.env, PUBKEY, vi.fn(), vi.fn());
  x.el.append(box.el);
  try {
    x.act.mockResolvedValueOnce(success({ encryptedKey: CIPHER }));
    choose(x.el);
    await tick();
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
    });
    (x.el.querySelector('[data-f="save-encrypted"]') as HTMLElement).click();
    expect(filename).toBe('lkjstr-abcdefgh.ncryptsec.txt');
    expect(create).toHaveBeenCalledOnce();
    const rawAnswer = deferred<ActResult>();
    x.act.mockReturnValueOnce(rawAnswer.promise);
    (x.el.querySelector('[data-f="raw"]') as HTMLElement).click();
    expect(x.act).toHaveBeenLastCalledWith({ a: 'account.key', pubkey: PUBKEY });
    const raw = x.el.querySelector<HTMLInputElement>('.kfield[type="password"]')!;
    (x.el.querySelector('[data-f="raw"]') as HTMLElement).click();
    rawAnswer.resolve(success({ key: 'nsec1fixture' }));
    await tick();
    expect(raw.value).toBe('');
    expect(x.el.querySelector('[data-f="show"]')).toBeNull();
    box.dispose();
    expect(revoke).toHaveBeenCalledWith('blob:fixture');
  } finally {
    box.dispose();
    x.dispose();
  }
});

it('folds and empties a revealed raw key when the page hides', async () => {
  const x = vaultEnv();
  const box = keyBox(x.env, PUBKEY, vi.fn(), vi.fn());
  x.el.append(box.el);
  try {
    x.act.mockResolvedValueOnce(success({ key: 'nsec1fixture' }));
    (x.el.querySelector('[data-f="raw"]') as HTMLElement).click();
    await tick();
    const raw = x.el.querySelector<HTMLInputElement>('.kfield[type="password"]')!;
    (x.el.querySelector('[data-f="show"]') as HTMLElement).click();
    expect(raw.type).toBe('text');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(raw.value).toBe('');
    expect(raw.type).toBe('password');
    expect(x.el.querySelector('[data-f="show"]')).toBeNull();
  } finally {
    box.dispose();
    x.dispose();
  }
});

it('shows only Unlock for a locked backup and preserves protocol 2 raw backup', async () => {
  for (const version of [6, 2]) {
    const x = vaultEnv({ encrypted: true, locked: true }, version);
    const unlock = vi.fn();
    x.act.mockResolvedValue(success({ key: 'nsec1fixture' }));
    const box = keyBox(x.env, PUBKEY, vi.fn(), unlock);
    x.el.append(box.el);
    try {
      if (version === 6) {
        expect(x.el.textContent).toContain('Unlock this account to back up its key.');
        expect(x.el.querySelectorAll('button')).toHaveLength(1);
        (x.el.querySelector('button') as HTMLElement).click();
        expect(unlock).toHaveBeenCalledOnce();
        expect(x.act).not.toHaveBeenCalled();
      } else {
        expect(x.act).toHaveBeenLastCalledWith({ a: 'account.key', pubkey: PUBKEY });
        expect(x.el.querySelector('[data-f="raw"]')).toBeNull();
      }
    } finally {
      box.dispose();
      x.dispose();
    }
  }
});

it('protects in export/import order and never displays ciphertext or removes an account', async () => {
  const x = vaultEnv();
  const changed = vi.fn();
  const box = protectBox(x.env, PUBKEY, vi.fn(), vi.fn(), changed);
  x.el.append(box.el);
  try {
    const exported = deferred<ActResult>();
    const imported = deferred<ActResult>();
    x.act.mockReturnValueOnce(exported.promise).mockReturnValueOnce(imported.promise);
    choose(x.el);
    expect(x.act).toHaveBeenCalledTimes(1);
    expect(fields(x.el).every((f) => !f.value)).toBe(true);
    exported.resolve(success({ encryptedKey: CIPHER }));
    await tick();
    expect(x.act.mock.calls.map(([a]) => a.a)).toEqual([
      'account.exportEncrypted',
      'account.importEncrypted',
    ]);
    expect(x.act).toHaveBeenLastCalledWith({
      a: 'account.importEncrypted',
      key: CIPHER,
      password: PASSWORD,
    });
    expect(x.el.outerHTML).not.toContain(CIPHER);
    imported.resolve(success());
    await tick();
    expect(changed).toHaveBeenCalledOnce();
    expect(x.el.textContent).toContain('Back up key');
    expect(x.el.querySelector('input')).toBeNull();
  } finally {
    box.dispose();
    x.dispose();
  }
});

it('cancelling protection before export completes prevents import; failure keeps the stored account', async () => {
  const x = vaultEnv();
  let box = protectBox(x.env, PUBKEY, () => box.dispose(), vi.fn(), vi.fn());
  x.el.append(box.el);
  try {
    const answer = deferred<ActResult>();
    x.act.mockReturnValueOnce(answer.promise);
    choose(x.el);
    (x.el.querySelector('[type="button"]') as HTMLElement).click();
    answer.resolve(success({ encryptedKey: CIPHER }));
    await tick();
    expect(x.act).toHaveBeenCalledTimes(1);
    x.el.replaceChildren();
    box = protectBox(x.env, PUBKEY, vi.fn(), vi.fn(), vi.fn());
    x.el.append(box.el);
    x.act.mockResolvedValueOnce(failure('internal'));
    choose(x.el);
    await tick();
    expect(x.el.textContent).toContain('Nothing was changed. The key is stored as before.');
    expect(x.accounts.get().accounts[0]?.encrypted).toBeUndefined();
    expect(x.act.mock.calls.some(([a]) => a.a === 'account.remove')).toBe(false);
    expect(document.activeElement).toBe(fields(x.el)[0]);
  } finally {
    box.dispose();
    x.dispose();
  }
});
