import type { Account } from '../../accounts/account';
import {
  sqliteDeleteAccount,
  sqlitePutAccount,
  sqliteReadAccounts,
} from '../sqlite-opfs/accounts-sqlite';

let memoryRows: Account[] = [];

export async function readAccountRows(fallback: Account[]): Promise<Account[]> {
  const rows = await sqliteReadAccounts().catch(() => undefined);
  memoryRows = rows ?? fallback;
  return memoryRows;
}

export async function putAccountRow(account: Account): Promise<void> {
  memoryRows = [account, ...memoryRows.filter((row) => row.id !== account.id)];
  await sqlitePutAccount(account).catch(() => false);
}

export async function deleteAccountRow(id: string): Promise<void> {
  memoryRows = memoryRows.filter((row) => row.id !== id);
  await sqliteDeleteAccount(id).catch(() => false);
}
