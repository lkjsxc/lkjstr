import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAccount } from '../../../src/lib/accounts/account';

const pubkey = 'a'.repeat(64);

describe('passkey local accounts', () => {
  afterEach(() => vi.resetModules());

  it('backfills portable largeBlob data when unlocking retained records', async () => {
    const secret = passkeySecret();
    const writePasskeyLargeBlob = vi.fn(async () => undefined);
    vi.doMock('../../../src/lib/accounts/passkey-secret-store', () => ({
      getPasskeySecret: vi.fn(async () => secret),
      listPasskeySecrets: vi.fn(async () => [secret]),
      savePasskeySecret: vi.fn(),
    }));
    vi.doMock('../../../src/lib/accounts/passkey-webauthn', () => ({
      getPasskeyPrf: vi.fn(async () => ({
        credentialId: secret.credentialId,
        prf: new Uint8Array(32),
      })),
      writePasskeyLargeBlob,
      createPasskeyPrf: vi.fn(),
      readDiscoverablePasskeyLargeBlob: vi.fn(),
      passkeySaltLabel: 'salt',
    }));
    vi.doMock('../../../src/lib/accounts/passkey-crypto', () => ({
      decryptPasskeySecret: vi.fn(async () => 'f'.repeat(64)),
      encryptPasskeySecret: vi.fn(),
    }));
    vi.doMock('../../../src/lib/accounts/passkey-session', () => ({
      unlockPasskeySession: vi.fn(),
      getUnlockedPasskeySecret: vi.fn(),
      isPasskeyUnlocked: vi.fn(),
      lockPasskeyAccount: vi.fn(),
    }));
    const { unlockPasskeyAccount } =
      await import('../../../src/lib/accounts/passkey-local');
    await unlockPasskeyAccount(createAccount(pubkey, 'passkey-local'));
    expect(writePasskeyLargeBlob).toHaveBeenCalledWith(
      secret.credentialId,
      expect.any(Uint8Array),
    );
  });
});

function passkeySecret() {
  return {
    accountId: `passkey-local:${pubkey}`,
    pubkey,
    credentialId: 'cred',
    saltLabel: 'salt',
    ciphertext: 'ct',
    iv: 'iv',
    createdAt: 1,
    updatedAt: 1,
  };
}
