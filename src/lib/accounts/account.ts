import { decodeEntity, encodeNpub } from '../protocol';

export type SignerType = 'readonly' | 'nip07' | 'local';

export type AccountCapabilities = {
  readonly read: boolean;
  readonly sign: boolean;
  readonly publish: boolean;
  readonly decrypt: boolean;
  readonly wallet: boolean;
};

export type Account = {
  readonly id: string;
  readonly pubkey: string;
  readonly npub: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly signerType: SignerType;
  readonly capabilities: AccountCapabilities;
  readonly defaultRelayGroupId: string | null;
  readonly profileEventId: string | null;
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
  readonly nip05: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastUsedAt: number | null;
};

export function createAccount(
  pubkey: string,
  signerType: SignerType,
  label = shortKey(pubkey),
): Account {
  const now = Date.now();
  return {
    id: `${signerType}:${pubkey}`,
    pubkey,
    npub: encodeNpub(pubkey),
    label,
    enabled: true,
    signerType,
    capabilities: capabilitiesFor(signerType),
    defaultRelayGroupId: null,
    profileEventId: null,
    avatarUrl: null,
    displayName: null,
    nip05: null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
  };
}

export function normalizeAccount(account: Account): Account {
  return {
    ...account,
    enabled: true,
    capabilities: capabilitiesFor(account.signerType),
  };
}

export function normalizeStoredAccount(account: Account): Account | undefined {
  if (!isSignerType(account.signerType)) return undefined;
  return normalizeAccount(account);
}

export function isSignerType(value: unknown): value is SignerType {
  return value === 'readonly' || value === 'nip07' || value === 'local';
}

export function parseReadonlyAccount(input: string): Account | undefined {
  const pubkey = parsePubkey(input);
  return pubkey ? createAccount(pubkey, 'readonly') : undefined;
}

export function parsePubkey(input: string): string | undefined {
  const trimmed = input.trim().toLowerCase();
  const decoded = decodeEntity(trimmed);
  if (decoded?.type === 'npub') return decoded.data;
  return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : undefined;
}

export function shortKey(pubkey: string): string {
  return `${pubkey.slice(0, 8)}:${pubkey.slice(-6)}`;
}

function capabilitiesFor(signerType: SignerType): AccountCapabilities {
  const canSign = signerType === 'nip07' || signerType === 'local';
  return {
    read: true,
    sign: canSign,
    publish: canSign,
    decrypt: canSign,
    wallet: false,
  };
}
