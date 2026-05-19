import {
  addNip07Account,
  addReadonlyAccount,
  addReadonlyPubkey,
} from '$lib/accounts/account-manager';
import { activeAccount, listAccounts } from '$lib/accounts/account-store';
import type { Account } from '$lib/accounts/account';
import { accountNotifications } from '$lib/notifications/notification-store';
import type { NotificationRecord } from '$lib/notifications/notification';
import { listRelaySets, type RelaySet } from '$lib/relays/relay-store';

export type WorkspacePageData = {
  readonly accounts: Account[];
  readonly activeAccount?: Account;
  readonly notifications: NotificationRecord[];
  readonly relaySets: RelaySet[];
};

export async function loadWorkspacePageData(): Promise<WorkspacePageData> {
  const accounts = await listAccounts();
  const relaySets = await listRelaySets();
  const active = await activeAccount();
  const notifications = active ? await accountNotifications(active.pubkey) : [];
  return { accounts, activeAccount: active, notifications, relaySets };
}

export async function addReadonlyFromInput(input: string): Promise<string> {
  await addReadonlyAccount(input);
  return 'Read-only account added.';
}

export async function addNip07FromProvider(): Promise<string> {
  await addNip07Account();
  return 'NIP-07 account added.';
}

export async function addReadonlyFromPubkey(pubkey: string): Promise<string> {
  await addReadonlyPubkey(pubkey);
  return 'Read-only account added.';
}
