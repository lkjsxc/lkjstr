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
});
