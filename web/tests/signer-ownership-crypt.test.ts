import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDmAccess } from '../src/engine/client-dm-access.ts';
import { createPrivateListClient } from '../src/engine/client-private-lists.ts';
import type { ToEngine } from '../src/engine/protocol.ts';
import { fixtureNow, rows } from './signer-ownership-fixture.ts';
import { account, deferred } from './vault-ui-fixture.ts';

const pubkey = '11'.repeat(32);
const injected = window as { nostr?: unknown };
function wire(scenario: keyof typeof rows) {
  const message = structuredClone(rows[scenario].message);
  if ('expiresAt' in message && message.expiresAt !== undefined)
    return { ...message, expiresAt: performance.timeOrigin + message.expiresAt - fixtureNow };
  return message;
}
beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'performance',
      'Date',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
});
afterEach(() => {
  delete injected.nostr;
  localStorage.clear();
  vi.useRealTimers();
});

it.each(['dm-encrypt', 'dm-visible', 'dm-background', 'private-list'] as const)(
  'native %s obeys its private authority and replies with exact correlation',
  async (scenario) => {
    const message = wire(scenario);
    if (message.t !== 'crypt') throw new Error('crypt');
    const out: ToEngine[] = [];
    const post = (message: ToEngine) => out.push(message);
    const access = createDmAccess(post);
    const who = account({
      signer: 'extension',
      author: { pubkey, npub: 'fixture', name: 'fixture' },
    });
    access.accounts([who]);
    access.allow(pubkey);
    const lists = createPrivateListClient(access, post);
    const cipher = vi.fn(async () => 'synthetic response');
    injected.nostr = {
      getPublicKey: async () => pubkey,
      nip44: { encrypt: cipher, decrypt: cipher },
    };
    try {
      if (scenario === 'private-list') {
        lists.open('m', { source: 'mutes', account: pubkey, privateLists: true });
        lists.visible('m', true);
        const done = lists.crypt(message);
        await vi.advanceTimersByTimeAsync(100);
        await done;
      } else {
        if (scenario === 'dm-background') {
          await access.crypt(message, () => true);
          expect(out.pop()).toEqual({ t: 'crypted', req: message.req, error: 'rate-limited' });
        }
        await access.crypt(message);
      }
      expect(cipher).toHaveBeenCalledTimes(1);
      expect(out).toEqual([{ t: 'crypted', req: message.req, value: 'synthetic response' }]);
    } finally {
      lists.dispose();
      access.dispose();
    }
  },
);

it.each(['dm-visible', 'private-list'] as const)(
  'native %s cancellation retires the exact pending crypto request and ignores late plaintext',
  async (scenario) => {
    const message = wire(scenario);
    const cancel = wire(scenario === 'private-list' ? 'private-list-cancel' : 'dm-read-cancel');
    if (message.t !== 'crypt' || cancel.t !== 'crypt.cancel') throw new Error('fixture');
    expect(cancel.req).toBe(message.req);
    const out: ToEngine[] = [];
    const post = (m: ToEngine) => out.push(m);
    const access = createDmAccess(post);
    access.accounts([
      account({ signer: 'extension', author: { pubkey, npub: 'fixture', name: 'fixture' } }),
    ]);
    access.allow(pubkey);
    const lists = createPrivateListClient(access, post);
    const held = deferred<string>();
    const decrypt = vi.fn(() => held.promise);
    injected.nostr = { getPublicKey: async () => pubkey, nip44: { decrypt } };
    try {
      lists.open('m', { source: 'mutes', account: pubkey, privateLists: true });
      lists.visible('m', true);
      const invoke = (request: typeof message) =>
        scenario === 'private-list' ? lists.crypt(request) : access.crypt(request);
      const done = invoke(message);
      await vi.advanceTimersByTimeAsync(100);
      expect(decrypt).toHaveBeenCalledTimes(1);
      // The same dispatch as the page client's crypt.cancel receiver.
      lists.cancel(cancel.req);
      access.cancel(cancel.req);
      held.resolve('retired secret');
      await vi.advanceTimersByTimeAsync(100);
      await done;
      expect(out).toEqual([]);
      decrypt.mockResolvedValue('fresh secret');
      const next = { ...message, req: 'fresh-crypto', data: 'fresh ciphertext' };
      const fresh = invoke(next);
      await vi.advanceTimersByTimeAsync(3000);
      await fresh;
      expect(out).toEqual([{ t: 'crypted', req: next.req, value: 'fresh secret' }]);
    } finally {
      lists.dispose();
      access.dispose();
    }
  },
);
