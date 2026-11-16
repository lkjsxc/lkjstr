import { vi } from 'vitest';
import type { Accounts, ActResult, Engine } from '../src/engine/client.ts';
import type { Account, Action } from '../src/engine/protocol.ts';
import { setLang } from '../src/shared/i18n.ts';
import { createSettings } from '../src/shared/settings.ts';
import { createSignal } from '../src/shared/signal.ts';
import type { ViewEnv } from '../src/views/registry.ts';

export const PUBKEY = 'a'.repeat(64);
export const CIPHER = 'ncryptsec1fixture-ciphertext-only';
export const PASSWORD = 'eight characters';
export const success = (extra: Partial<ActResult> = {}): ActResult => ({
  t: 'result',
  req: 'fixture',
  ok: true,
  ...extra,
});
export const failure = (code: NonNullable<ActResult['error']>['code']): ActResult =>
  success({ ok: false, error: { code } });

export function account(extra: Partial<Account> = {}): Account {
  return {
    author: { pubkey: PUBKEY, npub: 'npub1abcdefgh12345678', name: 'Aoi' },
    signer: 'local',
    unread: 0,
    ...extra,
  };
}
export function vaultEnv(extra: Partial<Account> = {}, version = 6) {
  setLang('en');
  const settings = createSettings();
  const accounts = createSignal<Accounts>({ active: PUBKEY, accounts: [account(extra)] });
  const act = vi.fn<(action: Action) => Promise<ActResult>>().mockResolvedValue(success());
  const open = vi.fn();
  const close = vi.fn();
  const visible = createSignal(true);
  const engine = {
    accounts,
    info: createSignal({ version, engine: 'fixture' }),
    status: createSignal({ connected: 0, wanted: 0, offline: false }),
    me: () => accounts.get().active ?? '',
    act,
    open: vi.fn(() => ({ id: 'fixture', near() {}, window() {}, visible() {}, close() {} })),
    configure() {},
    stats: async () => undefined,
    dispose() {},
  } as unknown as Engine;
  const layer = document.createElement('div');
  const el = document.createElement('div');
  document.body.append(el, layer);
  const env: ViewEnv = {
    engine,
    settings,
    layer,
    visible,
    instance: 'keys-fixture',
    open,
    close,
    setTitle() {},
    menu() {},
    resetLayouts() {},
  };
  return {
    env,
    el,
    act,
    accounts,
    open,
    close,
    visible,
    dispose: () => {
      settings.dispose();
      el.remove();
      layer.remove();
    },
  };
}
export function fill(field: HTMLInputElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
export function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}
export const tick = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
