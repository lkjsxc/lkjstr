import type { Account } from '../../accounts/account';
import { browserDb } from '../browser-db';
import { bestEffortStorageWrite, boundedStorageRead } from '../safe-storage';

export async function readAccountRows(fallback: Account[]): Promise<Account[]> {
  return boundedStorageRead(
    () => browserDb().accounts.orderBy('updatedAt').reverse().toArray(),
    fallback,
  );
}

export async function putAccountRow(account: Account): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().accounts.put(account));
}

export async function deleteAccountRow(id: string): Promise<void> {
  await bestEffortStorageWrite(() => browserDb().accounts.delete(id));
}
