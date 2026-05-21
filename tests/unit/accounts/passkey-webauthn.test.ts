import { afterEach, describe, expect, it, vi } from 'vitest';

describe('passkey WebAuthn PRF', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports unsupported browsers honestly', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    const { getPasskeyPrf } =
      await import('../../../src/lib/accounts/passkey-webauthn');
    await expect(getPasskeyPrf(['abc'])).rejects.toThrow(
      'WebAuthn passkeys are not supported in this browser.',
    );
  });

  it('rejects credentials that omit PRF output', async () => {
    const credential = {
      rawId: new Uint8Array([1, 2, 3]).buffer,
      getClientExtensionResults: () => ({ prf: { enabled: true } }),
    };
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn(async () => credential) },
    });
    vi.stubGlobal('window', { PublicKeyCredential: function () {} });
    const { getPasskeyPrf } =
      await import('../../../src/lib/accounts/passkey-webauthn');
    await expect(getPasskeyPrf(['abc'])).rejects.toThrow(
      'WebAuthn PRF output was not returned.',
    );
  });

  it('uses resident credentials, PRF, and required largeBlob on creation', async () => {
    const credential = {
      rawId: new Uint8Array([1, 2, 3]).buffer,
      getClientExtensionResults: () => ({
        prf: { results: { first: new Uint8Array(32).buffer } },
        largeBlob: { supported: true },
      }),
    };
    let createOptions: CredentialCreationOptions | undefined;
    const create = vi.fn(async (options: CredentialCreationOptions) => {
      createOptions = options;
      return credential;
    });
    vi.stubGlobal('navigator', { credentials: { create } });
    vi.stubGlobal('window', { PublicKeyCredential: function () {} });
    const { createPasskeyPrf } =
      await import('../../../src/lib/accounts/passkey-webauthn');
    await createPasskeyPrf({
      accountId: 'passkey-local:a',
      pubkey: 'a'.repeat(64),
      label: 'Passkey a',
    });
    expect(createOptions).toBeDefined();
    const publicKey = createOptions!.publicKey!;
    expect(publicKey.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'required',
    });
    expect(publicKey.extensions?.largeBlob).toEqual({ support: 'required' });
  });

  it('uses evalByCredential for known passkey PRF unlocks', async () => {
    const credential = {
      rawId: new Uint8Array([1, 2, 3]).buffer,
      getClientExtensionResults: () => ({
        prf: { results: { first: new Uint8Array(32).buffer } },
      }),
    };
    let getOptions: CredentialRequestOptions | undefined;
    const get = vi.fn(async (options: CredentialRequestOptions) => {
      getOptions = options;
      return credential;
    });
    vi.stubGlobal('navigator', { credentials: { get } });
    vi.stubGlobal('window', { PublicKeyCredential: function () {} });
    const { getPasskeyPrf } =
      await import('../../../src/lib/accounts/passkey-webauthn');
    await getPasskeyPrf(['abc']);
    expect(getOptions).toBeDefined();
    expect(getOptions!.publicKey!.extensions?.prf).toHaveProperty(
      'evalByCredential',
    );
  });

  it('explains discoverable passkeys without portable data', async () => {
    const credential = {
      rawId: new Uint8Array([1, 2, 3]).buffer,
      getClientExtensionResults: () => ({ largeBlob: {} }),
    };
    vi.stubGlobal('navigator', {
      credentials: { get: vi.fn(async () => credential) },
    });
    vi.stubGlobal('window', { PublicKeyCredential: function () {} });
    const { readDiscoverablePasskeyLargeBlob } =
      await import('../../../src/lib/accounts/passkey-webauthn');
    await expect(readDiscoverablePasskeyLargeBlob()).rejects.toThrow(
      'This passkey does not contain portable lkjstr data.',
    );
  });
});
