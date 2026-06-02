import type { LocalAccountSecret } from '../../accounts/local-secret-store';
import {
  sqliteDeleteLocalSecret,
  sqlitePutLocalSecret,
  sqliteReadLocalSecret,
} from '../sqlite-opfs/accounts-sqlite';

const memorySecrets = new Map<string, LocalAccountSecret>();
const startupReadDeadlineMs = 120;

export async function putLocalAccountSecretRow(
  secret: LocalAccountSecret,
): Promise<void> {
  memorySecrets.set(secret.accountId, secret);
  await sqlitePutLocalSecret(secret).catch(() => false);
}

export async function readLocalAccountSecretRow(
  accountId: string,
  fallback: LocalAccountSecret | undefined,
): Promise<LocalAccountSecret | undefined> {
  const memory = memorySecrets.get(accountId);
  if (memory) return memory;
  const row = await Promise.race([
    sqliteReadLocalSecret(accountId).catch(() => undefined),
    fallbackAfter(startupReadDeadlineMs, undefined),
  ]);
  const secret = row ?? fallback;
  if (secret) memorySecrets.set(accountId, secret);
  return secret;
}

export async function deleteLocalAccountSecretRow(
  accountId: string,
): Promise<void> {
  memorySecrets.delete(accountId);
  await sqliteDeleteLocalSecret(accountId).catch(() => false);
}

function fallbackAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
