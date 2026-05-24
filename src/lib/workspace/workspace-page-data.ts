import {
  addMinedLocalAccount,
  addNip07Account,
  createLocalAccount,
  importLocalNsec,
  addReadonlyAccount,
  addReadonlyPubkey,
} from '$lib/accounts/account-manager';
import { activeAccount, listAccounts } from '$lib/accounts/account-store';
import type { Account } from '$lib/accounts/account';
import { listRelaySets, type RelaySet } from '$lib/relays/relay-store';

export type WorkspacePageData = {
  readonly accounts: Account[];
  readonly activeAccount?: Account;
  readonly relaySets: RelaySet[];
};

export async function loadWorkspacePageData(): Promise<WorkspacePageData> {
  const accounts = await listAccounts();
  const relaySets = await listRelaySets();
  const active = await activeAccount();
  return { accounts, activeAccount: active, relaySets };
}

export async function addReadonlyFromInput(input: string): Promise<string> {
  await addReadonlyAccount(input);
  return 'Read-only account added.';
}

export async function addNip07FromProvider(): Promise<string> {
  await addNip07Account();
  return 'NIP-07 account added.';
}

export async function createLocalSigningAccount(): Promise<string> {
  await createLocalAccount();
  return 'Local account created.';
}

export async function importNsecAccount(input: string): Promise<string> {
  await importLocalNsec(input);
  return 'Local account imported.';
}

export async function addReadonlyFromPubkey(pubkey: string): Promise<string> {
  await addReadonlyPubkey(pubkey);
  return 'Read-only account added.';
}

export async function addMinedSigningAccount(nsec: string): Promise<string> {
  await addMinedLocalAccount(nsec);
  return 'Mined signing account added.';
}
