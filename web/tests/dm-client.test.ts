import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Transport } from '../src/engine/client.ts';
import { cryptWithExtension } from '../src/engine/client-crypto.ts';
import { createDmClient } from '../src/engine/client-dm.ts';
import type { DmSnapshot, FromEngine, ToEngine } from '../src/engine/protocol.ts';
import { createSignerOrchestrator } from '../src/engine/signer-orchestrator.ts';

const crypt = (message: Extract<FromEngine, { t: 'crypt' }>) =>
  createSignerOrchestrator().run(8, (call) => cryptWithExtension(message, call));

describe('private transport', () => {
  afterEach(() => {
    delete (window as { nostr?: unknown }).nostr;
  });
  it('refuses an extension using a different account before encryption', async () => {
    const encrypt = vi.fn(async () => 'ciphertext');
    (window as { nostr?: unknown }).nostr = {
      getPublicKey: async () => 'other',
      nip44: { encrypt },
    };
    await expect(
      crypt({
        t: 'crypt',
        req: 'r',
        pubkey: 'owner',
        peer: 'peer',
        operation: 'nip44.encrypt',
        data: 'private',
      }),
    ).rejects.toThrow('signer-refused');
    expect(encrypt).not.toHaveBeenCalled();
  });
  it('rejects an account switch while an encryption permission is pending', async () => {
    let account = 'owner';
    (window as { nostr?: unknown }).nostr = {
      getPublicKey: async () => account,
      nip44: {
        encrypt: async () => {
          account = 'other';
          return 'wrong-account cipher';
        },
      },
    };
    await expect(
      crypt({
        t: 'crypt',
        req: 'changed',
        pubkey: 'owner',
        peer: 'peer',
        operation: 'nip44.encrypt',
        data: 'private',
      }),
    ).rejects.toThrow('signer-refused');
  });
  it('reports absent crypto capability without returning a fake plaintext', async () => {
    (window as { nostr?: unknown }).nostr = { getPublicKey: async () => 'owner' };
    await expect(
      crypt({
        t: 'crypt',
        req: 'r',
        pubkey: 'owner',
        peer: 'peer',
        operation: 'nip04.decrypt',
        data: 'cipher',
      }),
    ).rejects.toThrow('unsupported');
  });
  it('keeps private callbacks scoped and closes their subscriptions', () => {
    const sent: ToEngine[] = [];
    const transport: Transport = { post: (m) => sent.push(m), listen: () => {}, close: () => {} };
    const dm = createDmClient(transport);
    const received: DmSnapshot[] = [];
    const sub = dm.open({ account: 'owner' }, (s) => received.push(s));
    const snapshot: DmSnapshot = {
      account: 'owner',
      conversations: [],
      messages: [],
      more: false,
      undecryptable: 0,
      phase: 'live',
    };
    dm.receive({ t: 'dm', sub: 'unrelated', snapshot });
    expect(received).toEqual([]);
    dm.receive({ t: 'dm', sub: sub.id, snapshot });
    expect(received).toEqual([snapshot]);
    sub.close();
    dm.receive({ t: 'dm', sub: sub.id, snapshot });
    expect(received).toEqual([snapshot]);
    expect(sent.at(-1)).toEqual({ t: 'dm.close', sub: sub.id });
  });
});
