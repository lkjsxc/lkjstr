import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
  safeGetItem,
  safeRemoveItem,
  safeSetItem,
} from '../storage/safe-storage';
import { normalizeAccount, type Account } from './account';
import { removeLocalSecret } from './local-secret-store';
import { lockPasskeyAccount } from './passkey-session';

const activeKey = 'lkjstr.activeAccountId';
let memoryAccounts: Account[] = [];
let memoryActiveAccountId: string | null = null;

export async function listAccounts(): Promise<Account[]> {
  const accounts = await boundedStorageRead(
    () => browserDb().accounts.orderBy('updatedAt').reverse().toArray(),
    memoryAccounts,
  );
  memoryAccounts = accounts.map(normalizeAccount);
  return memoryAccounts;
}

export async function saveAccount(account: Account): Promise<void> {
  const saved = normalizeAccount({ ...account, updatedAt: Date.now() });
  memoryAccounts = [
    saved,
    ...memoryAccounts.filter((item) => item.id !== account.id),
  ];
  await bestEffortStorageWrite(() => browserDb().accounts.put(saved));
}

export async function removeAccount(id: string): Promise<void> {
  const wasActive = getActiveAccountId() === id;
  memoryAccounts = memoryAccounts.filter((account) => account.id !== id);
  await bestEffortStorageWrite(() => browserDb().accounts.delete(id));
  await removeLocalSecret(id);
  lockPasskeyAccount(id);
  if (wasActive) await selectFallbackActiveAccount();
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
  const accounts = await listAccounts();
  const active = accounts.find((account) => account.id === id);
  if (active) return active;
  if (id) return selectFallbackActiveAccount();
  return undefined;
}

async function selectFallbackActiveAccount(): Promise<Account | undefined> {
  const next = (await listAccounts()).at(0);
  setActiveAccountId(next?.id ?? null);
  return next;
}
