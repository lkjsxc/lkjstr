import type { Account } from '../../accounts/account';
import {
  sqliteDeleteAccount,
  sqlitePutAccount,
  sqliteReadAccounts,
} from '../sqlite-opfs/accounts-sqlite';

let memoryRows: Account[] = [];
const startupReadDeadlineMs = 3_000;

export async function readAccountRows(fallback: Account[]): Promise<Account[]> {
  if (memoryRows.length > 0 || fallback.length > 0) {
    void refreshMemoryRows();
    return memoryRows.length > 0 ? memoryRows : fallback;
  }
  const rows = await Promise.race([
    sqliteReadAccounts().catch(() => undefined),
    fallbackAfter(startupReadDeadlineMs, undefined),
  ]);
  if (rows && (rows.length > 0 || memoryRows.length === 0)) memoryRows = rows;
  else memoryRows = fallback;
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

async function refreshMemoryRows(): Promise<void> {
  const rows = await sqliteReadAccounts().catch(() => undefined);
  if (rows && (rows.length > 0 || memoryRows.length === 0)) memoryRows = rows;
}

function fallbackAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
