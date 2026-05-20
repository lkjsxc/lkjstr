import type { NostrEvent, UnsignedNostrEvent } from '../protocol';
import type { Account } from './account';
import { activeAccount } from './account-store';
import { signLocalEvent } from './local';
import { getLocalSecret } from './local-secret-store';
import { getNip07Provider } from './nip07';

export type AccountSigner = {
  readonly account: Account;
  readonly signEvent: (event: UnsignedNostrEvent) => Promise<NostrEvent>;
};

export async function resolveActiveSigner(): Promise<AccountSigner> {
  const account = await activeAccount();
  if (!account) throw new Error('Add a signing account first.');
  if (account.signerType === 'local') return localSigner(account);
  if (account.signerType === 'nip07') return nip07Signer(account);
  throw new Error('Select an account that can sign.');
}

async function localSigner(account: Account): Promise<AccountSigner> {
  const secret = await getLocalSecret(account.id);
  if (!secret) throw new Error('Local account secret is unavailable.');
  return {
    account,
    signEvent: async (event) =>
      signLocalEvent(plainUnsignedEvent(event), secret.secretKey),
  };
}

function nip07Signer(account: Account): AccountSigner {
  const provider = getNip07Provider();
  if (!provider) throw new Error('NIP-07 signer unavailable.');
  return {
    account,
    signEvent: (event) => provider.signEvent(plainUnsignedEvent(event)),
  };
}

function plainUnsignedEvent(event: UnsignedNostrEvent): UnsignedNostrEvent {
  return {
    pubkey: String(event.pubkey),
    created_at: Number(event.created_at),
    kind: Number(event.kind),
    tags: event.tags.map((tag) => tag.map((part) => String(part))),
    content: String(event.content),
  };
}
