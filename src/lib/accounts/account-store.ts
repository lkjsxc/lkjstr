import { browserDb } from '../storage/browser-db';
import type { Account } from './account';

const activeKey = 'lkjstr.activeAccountId';

export async function listAccounts(): Promise<Account[]> {
  return browserDb().accounts.orderBy('updatedAt').reverse().toArray();
}

export async function saveAccount(account: Account): Promise<void> {
  await browserDb().accounts.put({ ...account, updatedAt: Date.now() });
}

export async function removeAccount(id: string): Promise<void> {
  await browserDb().accounts.delete(id);
  if (getActiveAccountId() === id) setActiveAccountId(null);
}

export function getActiveAccountId(): string | null {
  return browserLocalStorage()?.getItem(activeKey) ?? null;
}

export function setActiveAccountId(id: string | null): void {
  const storage = browserLocalStorage();
  if (!storage) return;
  if (id) storage.setItem(activeKey, id);
  else storage.removeItem(activeKey);
}

export async function activeAccount(): Promise<Account | undefined> {
  const id = getActiveAccountId();
  return id ? browserDb().accounts.get(id) : undefined;
}

function browserLocalStorage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}
