import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from '../storage/safe-storage';
import type { Account } from './account';

const activeKey = 'lkjstr.activeAccountId';
let memoryAccounts: Account[] = [];
let memoryActiveAccountId: string | null = null;

export async function listAccounts(): Promise<Account[]> {
  const accounts = await boundedStorageRead(
    () => browserDb().accounts.orderBy('updatedAt').reverse().toArray(),
    memoryAccounts,
  );
  memoryAccounts = [...accounts];
  return accounts;
}

export async function saveAccount(account: Account): Promise<void> {
  const saved = { ...account, updatedAt: Date.now() };
  memoryAccounts = [
    saved,
    ...memoryAccounts.filter((item) => item.id !== account.id),
  ];
  await bestEffortStorageWrite(() => browserDb().accounts.put(saved));
}

export async function removeAccount(id: string): Promise<void> {
  memoryAccounts = memoryAccounts.filter((account) => account.id !== id);
  await bestEffortStorageWrite(() => browserDb().accounts.delete(id));
  if (getActiveAccountId() === id) setActiveAccountId(null);
}

export function getActiveAccountId(): string | null {
  return safeGetItem(activeKey) ?? memoryActiveAccountId;
}

export function setActiveAccountId(id: string | null): void {
  memoryActiveAccountId = id;
  if (id) safeSetItem(activeKey, id);
  else safeRemoveItem(activeKey);
}

export async function activeAccount(): Promise<Account | undefined> {
  const id = getActiveAccountId();
  if (!id) return undefined;
  return boundedStorageRead(
    () => browserDb().accounts.get(id),
    memoryAccounts.find((account) => account.id === id),
  );
}
