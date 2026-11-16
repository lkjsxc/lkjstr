import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ActResult } from '../src/engine/client.ts';
import { createIdleLock } from '../src/shared/account-idle.ts';
import { account, deferred, PUBKEY, success, vaultEnv } from './vault-ui-fixture.ts';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('defaults off, then locks every unlocked protected account after key and pointer inactivity', async () => {
  const x = vaultEnv({ encrypted: true, locked: false });
  x.accounts.set({
    active: PUBKEY,
    accounts: [
      account({ encrypted: true, locked: false }),
      account({
        author: { ...account().author, pubkey: 'b'.repeat(64) },
        encrypted: true,
        locked: false,
      }),
      account({ author: { ...account().author, pubkey: 'c'.repeat(64) } }),
      account({ author: { ...account().author, pubkey: 'd'.repeat(64) }, signer: 'remote' }),
    ],
  });
  const dispose = createIdleLock(x.env.engine, x.env.settings, { channel: null });
  try {
    await vi.advanceTimersByTimeAsync(600_000);
    expect(x.act).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown'));
    x.env.settings.patch({ lockIdle: 1 });
    await vi.advanceTimersByTimeAsync(59_000);
    document.dispatchEvent(new Event('pointermove'));
    await vi.advanceTimersByTimeAsync(59_000);
    expect(x.act).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1750);
    expect(x.act.mock.calls.map(([a]) => a)).toEqual([
      { a: 'account.lock', pubkey: PUBKEY },
      { a: 'account.lock', pubkey: 'b'.repeat(64) },
    ]);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(x.act).toHaveBeenCalledTimes(2);
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: true })] });
    x.accounts.set({ active: PUBKEY, accounts: [account({ encrypted: true, locked: false })] });
    await vi.advanceTimersByTimeAsync(750);
    expect(x.act).toHaveBeenCalledTimes(3);
  } finally {
    dispose();
    x.dispose();
  }
});

it('counts hidden time and catches a suspended deadline on wake without duplicate in-flight locks', async () => {
  const x = vaultEnv({ encrypted: true, locked: false });
  x.env.settings.patch({ lockIdle: 1 });
  const answer = deferred<ActResult>();
  x.act.mockReturnValue(answer.promise);
  const dispose = createIdleLock(x.env.engine, x.env.settings, { channel: null });
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  try {
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    vi.setSystemTime(Date.now() + 61_000);
    document.dispatchEvent(new Event('pointermove'));
    expect(x.act).not.toHaveBeenCalled();
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    x.accounts.set({ ...x.accounts.get() });
    await vi.advanceTimersByTimeAsync(750);
    expect(x.act).toHaveBeenCalledOnce();
    answer.resolve(success());
  } finally {
    dispose();
    x.dispose();
  }
});

it('does not send vault actions to protocol 5 or after disposal', async () => {
  const x = vaultEnv({ encrypted: true, locked: false }, 5);
  x.env.settings.patch({ lockIdle: 1 });
  const dispose = createIdleLock(x.env.engine, x.env.settings, { channel: null });
  await vi.advanceTimersByTimeAsync(120_000);
  expect(x.act).not.toHaveBeenCalled();
  dispose();
  x.env.engine.info.set({ engine: 'fixture', version: 6 });
  document.dispatchEvent(new KeyboardEvent('keydown'));
  await vi.advanceTimersByTimeAsync(120_000);
  expect(x.act).not.toHaveBeenCalled();
  x.dispose();
});
