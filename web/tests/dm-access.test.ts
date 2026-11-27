import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDmAccess } from '../src/engine/client-dm-access.ts';
import type { FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { account, deferred, PUBKEY, tick } from './vault-ui-fixture.ts';

beforeEach(() => localStorage.clear());
afterEach(() => {
  delete (window as { nostr?: unknown }).nostr;
  vi.useRealTimers();
});
const crypt = (req: string): Extract<FromEngine, { t: 'crypt' }> => ({
  t: 'crypt',
  req,
  pubkey: PUBKEY,
  peer: 'b'.repeat(64),
  operation: 'nip44.decrypt',
  data: 'encrypted fixture',
});
it('asks once per external account, never persists decrypted text, and serializes a refused queue', async () => {
  const out: ToEngine[] = [],
    access = createDmAccess((m) => out.push(m)),
    who = account({ signer: 'extension' });
  access.accounts([who]);
  expect(access.status(who)).toBe('ask');
  const first = deferred<string>();
  const decrypt = vi.fn(() => first.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  await access.crypt(crypt('unasked'));
  expect(decrypt).not.toHaveBeenCalled();
  access.allow(PUBKEY);
  expect(localStorage.getItem(`lkjstr:dm-ok:${PUBKEY}`)).toBe('true');
  const a = access.crypt(crypt('a')),
    b = access.crypt(crypt('b'));
  await vi.waitFor(() => expect(decrypt).toHaveBeenCalledTimes(1));
  first.resolve(Promise.reject(new Error('refused')) as unknown as string);
  await Promise.all([a, b]);
  expect(decrypt).toHaveBeenCalledTimes(1);
  expect(access.status(who)).toBe('refused');
  expect(out.filter((m) => m.t === 'crypted' && 'value' in m)).toEqual([]);
  access.retry(PUBKEY);
  decrypt.mockResolvedValue('private plaintext');
  await access.crypt(crypt('retry'));
  expect(decrypt).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(localStorage)).not.toContain('private plaintext');
  access.dispose();
});
it('a pause or lock revokes a queued prompt and a late plaintext without latching the next visit', async () => {
  const out: ToEngine[] = [],
    access = createDmAccess((m) => out.push(m)),
    who = account({ signer: 'extension' });
  access.accounts([who]);
  access.allow(PUBKEY);
  const first = deferred<string>(),
    decrypt = vi.fn(() => first.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  const a = access.crypt(crypt('a')),
    b = access.crypt(crypt('b'));
  await vi.waitFor(() => expect(decrypt).toHaveBeenCalledTimes(1));
  access.pause(PUBKEY);
  first.resolve('late private plaintext');
  await Promise.all([a, b]);
  expect(decrypt).toHaveBeenCalledTimes(1);
  expect(access.status(who)).toBe('ready');
  expect(out.every((m) => m.t !== 'crypted' || !('value' in m))).toBe(true);
  access.accounts([account({ signer: 'extension', locked: true })]);
  await access.crypt(crypt('locked'));
  expect(decrypt).toHaveBeenCalledTimes(1);
  access.dispose();
});

it('bounds an unanswered signer call, then Retry starts without waiting for its abandoned promise', async () => {
  vi.useFakeTimers();
  const out: ToEngine[] = [],
    access = createDmAccess((m) => out.push(m)),
    who = account({ signer: 'extension' });
  access.accounts([who]);
  access.allow(PUBKEY);
  const original = deferred<string>(),
    decrypt = vi.fn(() => original.promise);
  (window as { nostr?: unknown }).nostr = { getPublicKey: async () => PUBKEY, nip44: { decrypt } };
  const pending = access.crypt(crypt('deadline'));
  await tick();
  await vi.advanceTimersByTimeAsync(60000);
  await pending;
  expect(out).toContainEqual({ t: 'crypted', req: 'deadline', error: 'signer-timeout' });
  expect(access.status(who)).toBe('timeout');
  access.retry(PUBKEY);
  decrypt.mockResolvedValue('current reply');
  await access.crypt(crypt('current'));
  expect(out).toContainEqual({ t: 'crypted', req: 'current', value: 'current reply' });
  original.resolve('abandoned late plaintext');
  await tick();
  expect(out.filter((m) => m.t === 'crypted' && m.req === 'deadline')).toHaveLength(1);
  access.dispose();
});

it('defers a passive decrypt if Post takes priority during its public key lookup', async () => {
  const out: ToEngine[] = [];
  const access = createDmAccess((message) => out.push(message));
  const who = account({ signer: 'extension' });
  access.accounts([who]);
  access.allow(PUBKEY);
  const lookup = deferred<string>();
  const getPublicKey = vi.fn(() => lookup.promise);
  const decrypt = vi.fn(async () => 'fixture reply');
  (window as { nostr?: unknown }).nostr = { getPublicKey, nip44: { decrypt } };
  let writing = false;
  const priority = () => writing;
  const passive = access.crypt({ ...crypt('passive'), background: true }, priority);
  await tick();
  expect(getPublicKey).toHaveBeenCalledTimes(1);
  writing = true;
  lookup.resolve(PUBKEY);
  await passive;
  expect(decrypt).not.toHaveBeenCalled();
  expect(out).toEqual([{ t: 'crypted', req: 'passive', error: 'rate-limited' }]);
  expect(access.status(who)).toBe('ready');
  await access.crypt(crypt('explicit-inbox'), priority);
  expect(out).toContainEqual({ t: 'crypted', req: 'explicit-inbox', value: 'fixture reply' });
  access.dispose();
});
