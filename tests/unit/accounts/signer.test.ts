import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../../../src/lib/accounts/account';
import type { UnsignedNostrEvent } from '../../../src/lib/protocol';

describe('account signer resolution', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('calls NIP-07 signEvent with provider context intact', async () => {
    const account = createAccount('a'.repeat(64), 'nip07');
    const provider = {
      _call: vi.fn(async (_method: string, event: UnsignedNostrEvent) => ({
        ...event,
        id: 'b'.repeat(64),
        sig: 'c'.repeat(128),
      })),
      signEvent(event: UnsignedNostrEvent) {
        return this._call('signEvent', event);
      },
    };
    vi.doMock('../../../src/lib/accounts/account-store', () => ({
      activeAccount: vi.fn(async () => account),
    }));
    vi.doMock('../../../src/lib/accounts/nip07', () => ({
      getNip07Provider: () => provider,
    }));

    const { resolveActiveSigner } =
      await import('../../../src/lib/accounts/signer');
    const signer = await resolveActiveSigner();
    const signed = await signer.signEvent({
      pubkey: account.pubkey,
      created_at: 1,
      kind: 1,
      tags: [],
      content: 'hello',
    });

    expect(provider._call).toHaveBeenCalledOnce();
    expect(signed.id).toBe('b'.repeat(64));
  });

  it('passes cloneable plain event data to NIP-07 signers', async () => {
    const account = createAccount('a'.repeat(64), 'nip07');
    const sourceTag = new Proxy(['imeta', 'url https://cdn.example/a.png'], {});
    const provider = {
      signEvent: vi.fn(async (event: UnsignedNostrEvent) => {
        expect(() => structuredClone(event)).not.toThrow();
        expect(event.tags[0]).toEqual([
          'imeta',
          'url https://cdn.example/a.png',
        ]);
        expect(event.tags[0]).not.toBe(sourceTag);
        return {
          ...event,
          id: 'b'.repeat(64),
          sig: 'c'.repeat(128),
        };
      }),
    };
    vi.doMock('../../../src/lib/accounts/account-store', () => ({
      activeAccount: vi.fn(async () => account),
    }));
    vi.doMock('../../../src/lib/accounts/nip07', () => ({
      getNip07Provider: () => provider,
    }));

    const { resolveActiveSigner } =
      await import('../../../src/lib/accounts/signer');
    const signer = await resolveActiveSigner();
    await signer.signEvent({
      pubkey: account.pubkey,
      created_at: 1,
      kind: 1,
      tags: [sourceTag],
      content: 'media note',
    });

    expect(provider.signEvent).toHaveBeenCalledOnce();
  });
});
