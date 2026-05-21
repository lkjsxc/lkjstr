import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeNpub } from '../../../src/lib/protocol';
import {
  createAccount,
  normalizeAccount,
  parseReadonlyAccount,
  shortKey,
} from '../../../src/lib/accounts/account';
import {
  connectNip07,
  getNip07Provider,
} from '../../../src/lib/accounts/nip07';

const pubkey = 'a'.repeat(64);

describe('account helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('formats short public key labels', () => {
    expect(shortKey(pubkey)).toBe('aaaaaaaa:aaaaaa');
  });

  it('parses readonly accounts from hex public keys', () => {
    expect(parseReadonlyAccount(` ${pubkey} `)).toMatchObject({
      signerType: 'readonly',
      pubkey,
      label: 'aaaaaaaa:aaaaaa',
      capabilities: { read: true, sign: false, publish: false },
    });
  });

  it('parses readonly accounts from npub entities', () => {
    expect(parseReadonlyAccount(encodeNpub(pubkey))).toMatchObject({
      signerType: 'readonly',
      pubkey,
      label: 'aaaaaaaa:aaaaaa',
    });
  });

  it('rejects unsupported readonly account input', () => {
    expect(parseReadonlyAccount('not-a-key')).toBeUndefined();
    expect(parseReadonlyAccount('f'.repeat(63))).toBeUndefined();
  });

  it('normalizes legacy accounts to enabled', () => {
    expect(
      normalizeAccount({
        ...createAccount(pubkey, 'readonly'),
        enabled: undefined as unknown as boolean,
      }).enabled,
    ).toBe(true);
  });

  it('creates locked passkey-local accounts without static signing capability', () => {
    expect(createAccount(pubkey, 'passkey-local')).toMatchObject({
      signerType: 'passkey-local',
      capabilities: { read: true, sign: false, publish: false },
    });
  });

  it('connects to NIP-07 providers when present', async () => {
    const provider = {
      getPublicKey: vi.fn().mockResolvedValue(pubkey),
      signEvent: vi.fn(),
    };

    await expect(connectNip07(provider)).resolves.toMatchObject({
      signerType: 'nip07',
      pubkey,
      label: 'NIP-07 aaaaaaaa',
      capabilities: { read: true, sign: true, publish: true },
    });
    expect(provider.getPublicKey).toHaveBeenCalledOnce();
  });

  it('reads NIP-07 providers from the browser window', () => {
    const provider = {
      getPublicKey: vi.fn(),
      signEvent: vi.fn(),
    };

    vi.stubGlobal('window', { nostr: provider });

    expect(getNip07Provider()).toBe(provider);
  });

  it('returns undefined when no NIP-07 provider is available', async () => {
    await expect(connectNip07(undefined)).resolves.toBeUndefined();
  });
});
