import type { LocalAccountSecret } from '../../accounts/local-secret-store';
import {
  sqliteDeleteLocalSecret,
  sqlitePutLocalSecret,
  sqliteReadLocalSecret,
} from '../sqlite-opfs/accounts-sqlite';

const memorySecrets = new Map<string, LocalAccountSecret>();

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
  const row = await sqliteReadLocalSecret(accountId).catch(() => undefined);
  const secret = row ?? memorySecrets.get(accountId) ?? fallback;
  if (secret) memorySecrets.set(accountId, secret);
  return secret;
}

export async function deleteLocalAccountSecretRow(
  accountId: string,
): Promise<void> {
  memorySecrets.delete(accountId);
  await sqliteDeleteLocalSecret(accountId).catch(() => false);
}
