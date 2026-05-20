import {
  createAccount,
  parsePubkey,
  parseReadonlyAccount,
  type Account,
} from './account';
import { saveAccount, setActiveAccountId } from './account-store';
import {
  createLocalAccountRecord,
  parseNsec,
  persistLocalAccount,
} from './local';
import { connectNip07, type Nip07Provider } from './nip07';

export async function addReadonlyAccount(input: string): Promise<Account> {
  const account = parseReadonlyAccount(input);
  if (!account) throw new Error('Read-only account input is invalid.');
  await saveAccount(account);
  setActiveAccountId(account.id);
  return account;
}

export async function addReadonlyPubkey(pubkey: string): Promise<Account> {
  const parsed = parsePubkey(pubkey);
  if (!parsed) throw new Error('Mined public key is invalid.');
  const account = createAccount(parsed, 'readonly');
  await saveAccount(account);
  setActiveAccountId(account.id);
  return account;
}

export async function createLocalAccount(): Promise<Account> {
  const { account, secretKey } = createLocalAccountRecord();
  await persistLocalAccount(account, secretKey);
  await saveAccount(account);
  setActiveAccountId(account.id);
  return account;
}

export async function importLocalNsec(input: string): Promise<Account> {
  const secret = parseNsec(input);
  if (!secret) throw new Error('nsec input is invalid.');
  const { account, secretKey } = createLocalAccountRecord(secret);
  await persistLocalAccount(account, secretKey);
  await saveAccount(account);
  setActiveAccountId(account.id);
  return account;
}

export async function addMinedLocalAccount(nsec: string): Promise<Account> {
  return importLocalNsec(nsec);
}

export async function addNip07Account(
  provider?: Nip07Provider,
): Promise<Account> {
  const account = await connectNip07(provider);
  if (!account) throw new Error('NIP-07 signer is unavailable.');
  await saveAccount(account);
  setActiveAccountId(account.id);
  return account;
}

export async function touchAccountUse(account: Account): Promise<Account> {
  const updated = { ...account, lastUsedAt: Date.now(), updatedAt: Date.now() };
  await saveAccount(updated);
  setActiveAccountId(updated.id);
  return updated;
}

export function readOnlyAccountFromPubkey(pubkey: string): Account {
  return createAccount(pubkey, 'readonly');
}
