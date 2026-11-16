import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDmAccess } from '../src/engine/client-dm-access.ts';
import { createPrivateListClient } from '../src/engine/client-private-lists.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { account, deferred, PUBKEY, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  delete (window as { nostr?: unknown }).nostr;
  vi.useRealTimers();
});
const request = (req: string, list = true): Extract<FromEngine, { t: 'crypt' }> => ({
  t: 'crypt',
  req,
  pubkey: PUBKEY,
  peer: PUBKEY,
  operation: 'nip44.decrypt',
  data: 'ciphertext fixture',
  ...(list
    ? { context: { kind: 'private-list' as const, sub: 'list', event: 'e'.repeat(64) } }
    : {}),
});
function fixture() {
  const out: ToEngine[] = [];
  const access = createDmAccess((message) => out.push(message));
  const who = account({ signer: 'extension' });
  access.accounts([who]);
  const lists = createPrivateListClient(access, (message) => out.push(message));
  lists.open('list', { source: 'mutes', account: PUBKEY, privateLists: true });
  lists.visible('list', true);
  return { out, access, who, lists };
}
it.each(['hide', 'close', 'worker', 'lock', 'remove', 'dispose'] as const)(
  '%s during a public-key prompt cannot start a later private decrypt',
  async (stop) => {
    const { out, access, who, lists } = fixture();
    const key = deferred<string>();
    const getPublicKey = vi.fn(() => key.promise);
    const decrypt = vi.fn(async () => 'private plaintext');
    (window as { nostr?: unknown }).nostr = { getPublicKey, nip44: { decrypt } };
    try {
      const pending = lists.crypt(request('old'));
      await tick();
      expect(getPublicKey).toHaveBeenCalledTimes(1);
      if (stop === 'hide') lists.visible('list', false);
      else if (stop === 'close') lists.close('list');
      else if (stop === 'worker') lists.cancel('old');
      else if (stop === 'lock') access.accounts([account({ signer: 'extension', locked: true })]);
      else if (stop === 'remove') access.accounts([]);
      else access.dispose();
      await pending;
      key.resolve(PUBKEY);
      await tick();
      expect(decrypt).not.toHaveBeenCalled();
      expect(getPublicKey).toHaveBeenCalledTimes(1);
      expect(out).toEqual([]);
      expect(access.status(who)).toBe('ask');
      expect(localStorage.getItem(`lkjstr:dm-ok:${PUBKEY}`)).toBeNull();
    } finally {
      lists.dispose();
      access.dispose();
    }
  },
);
it('cancelling a pending decrypt also prevents its later public-key recheck', async () => {
  const { out, access, who, lists } = fixture();
  const plaintext = deferred<string>();
  const getPublicKey = vi.fn(async () => PUBKEY);
  const decrypt = vi.fn(() => plaintext.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey, nip44: { decrypt } };
  try {
    const pending = lists.crypt(request('old'));
    await tick();
    expect(decrypt).toHaveBeenCalledTimes(1);
    lists.cancel('old');
    await pending;
    plaintext.resolve('revoked plaintext');
    await tick();
    expect(getPublicKey).toHaveBeenCalledTimes(1);
    expect(out).toEqual([]);
    expect(access.status(who)).toBe('ask');
  } finally {
    lists.dispose();
    access.dispose();
  }
});
it('a timed-out key prompt cannot decrypt later or block the next Messages operation', async () => {
  vi.useFakeTimers();
  const { out, access, who, lists } = fixture();
  const key = deferred<string>();
  const getPublicKey = vi.fn(() => key.promise);
  const decrypt = vi.fn(async () => 'current reply');
  (window as { nostr?: unknown }).nostr = { getPublicKey, nip44: { decrypt } };
  try {
    const pending = lists.crypt(request('deadline'));
    await tick();
    await vi.advanceTimersByTimeAsync(60_000);
    await pending;
    expect(out).toEqual([{ t: 'crypted', req: 'deadline', error: 'signer-timeout' }]);
    expect(access.status(who)).toBe('ask');
    key.resolve(PUBKEY);
    await tick();
    expect(decrypt).not.toHaveBeenCalled();
    access.allow(PUBKEY);
    getPublicKey.mockResolvedValue(PUBKEY);
    await access.crypt(request('dm', false));
    expect(out).toContainEqual({ t: 'crypted', req: 'dm', value: 'current reply' });
    expect(
      out.filter((message) => message.t === 'crypted' && message.req === 'deadline'),
    ).toHaveLength(1);
    expect(access.status(who)).toBe('ready');
  } finally {
    lists.dispose();
    access.dispose();
  }
});
it('a Messages pause consumes the key-check lifetime without latching a refusal', async () => {
  const { out, access, who, lists } = fixture();
  const key = deferred<string>();
  const getPublicKey = vi.fn(() => key.promise);
  const decrypt = vi.fn(async () => 'current reply');
  (window as { nostr?: unknown }).nostr = { getPublicKey, nip44: { decrypt } };
  try {
    access.allow(PUBKEY);
    const pending = access.crypt(request('paused', false));
    await tick();
    access.pause(PUBKEY);
    key.resolve(PUBKEY);
    await pending;
    expect(decrypt).not.toHaveBeenCalled();
    expect(out).toEqual([{ t: 'crypted', req: 'paused', error: 'signer-refused' }]);
    expect(access.status(who)).toBe('ready');
    getPublicKey.mockResolvedValue(PUBKEY);
    await access.crypt(request('current', false));
    expect(out).toContainEqual({ t: 'crypted', req: 'current', value: 'current reply' });
  } finally {
    lists.dispose();
    access.dispose();
  }
});
