import { base64urlToBytes, bytesToBase64url } from './base64url';

export const passkeySaltLabel = 'lkjstr passkey local account unlock';

type PrfResults = {
  prf?: { enabled?: boolean; results?: { first?: BufferSource } };
  largeBlob?: { supported?: boolean; blob?: BufferSource; written?: boolean };
};
type PublicKeyCredentialWithResults = PublicKeyCredential & {
  getClientExtensionResults: () => PrfResults;
};
type CredentialExtensions = AuthenticationExtensionsClientInputs & {
  prf?: {
    eval?: { first: BufferSource };
    evalByCredential?: Record<string, { first: BufferSource }>;
  };
  largeBlob?: {
    support?: 'required';
    read?: boolean;
    write?: BufferSource;
  };
};

const rpName = 'lkjstr';
const salt = new TextEncoder().encode(passkeySaltLabel);

export async function createPasskeyPrf(input: {
  readonly accountId: string;
  readonly pubkey: string;
  readonly label: string;
}): Promise<{ credentialId: string; prf: Uint8Array }> {
  ensureWebAuthn();
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: rpName },
      user: {
        id: new TextEncoder().encode(input.pubkey),
        name: input.label,
        displayName: input.label,
      },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
      extensions: {
        prf: { eval: { first: salt } },
        largeBlob: { support: 'required' },
      } as CredentialExtensions,
    } as PublicKeyCredentialCreationOptions,
  });
  const publicKey = credential as PublicKeyCredentialWithResults | null;
  if (!publicKey) throw new Error('Passkey creation was canceled.');
  if (publicKey.getClientExtensionResults().largeBlob?.supported !== true)
    throw new Error('WebAuthn largeBlob is required for portable passkeys.');
  return {
    credentialId: bytesToBase64url(new Uint8Array(publicKey.rawId)),
    prf: prfOutput(publicKey),
  };
}

export async function getPasskeyPrf(
  credentialIds: readonly string[],
): Promise<{ credentialId: string; prf: Uint8Array }> {
  ensureWebAuthn();
  if (credentialIds.length === 0)
    throw new Error('No stored passkey accounts are available.');
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: credentialIds.map((id) => ({
        type: 'public-key',
        id: base64urlToBytes(id),
      })),
      userVerification: 'required',
      extensions: {
        prf: { evalByCredential: prfInputs(credentialIds) },
      } as CredentialExtensions,
    } as PublicKeyCredentialRequestOptions,
  });
  const publicKey = credential as PublicKeyCredentialWithResults | null;
  if (!publicKey) throw new Error('Passkey unlock was canceled.');
  return {
    credentialId: bytesToBase64url(new Uint8Array(publicKey.rawId)),
    prf: prfOutput(publicKey),
  };
}

export async function writePasskeyLargeBlob(
  credentialId: string,
  blob: Uint8Array,
): Promise<void> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [
        { type: 'public-key', id: base64urlToBytes(credentialId) },
      ],
      userVerification: 'required',
      extensions: { largeBlob: { write: blob } } as CredentialExtensions,
    } as PublicKeyCredentialRequestOptions,
  });
  const publicKey = credential as PublicKeyCredentialWithResults | null;
  if (!publicKey) throw new Error('Passkey largeBlob write was canceled.');
  if (publicKey.getClientExtensionResults().largeBlob?.written !== true)
    throw new Error('Passkey largeBlob write was not confirmed.');
}

export async function readDiscoverablePasskeyLargeBlob(): Promise<{
  credentialId: string;
  blob: BufferSource;
}> {
  ensureWebAuthn();
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      userVerification: 'required',
      extensions: { largeBlob: { read: true } } as CredentialExtensions,
    } as PublicKeyCredentialRequestOptions,
  });
  const publicKey = credential as PublicKeyCredentialWithResults | null;
  if (!publicKey) throw new Error('Passkey login was canceled.');
  const blob = publicKey.getClientExtensionResults().largeBlob?.blob;
  if (!blob) throw new Error('Passkey largeBlob data was not returned.');
  return {
    credentialId: bytesToBase64url(new Uint8Array(publicKey.rawId)),
    blob,
  };
}

function ensureWebAuthn(): void {
  if (
    typeof navigator === 'undefined' ||
    typeof window === 'undefined' ||
    !navigator.credentials ||
    !window.PublicKeyCredential
  )
    throw new Error('WebAuthn passkeys are not supported in this browser.');
}

function prfOutput(credential: PublicKeyCredentialWithResults): Uint8Array {
  const result = credential.getClientExtensionResults().prf;
  if (!result?.enabled && !result?.results?.first)
    throw new Error('WebAuthn PRF is not supported by this passkey.');
  const first = result.results?.first;
  if (!first) throw new Error('WebAuthn PRF output was not returned.');
  return bufferSourceBytes(first);
}

function prfInputs(
  credentialIds: readonly string[],
): Record<string, { first: BufferSource }> {
  return Object.fromEntries(
    credentialIds.map((credentialId) => [credentialId, { first: salt }]),
  );
}

function bufferSourceBytes(source: BufferSource): Uint8Array {
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}
