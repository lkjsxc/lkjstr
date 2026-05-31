import type { LocalAccountSecret } from '../../accounts/local-secret-store';
import { browserDb } from '../browser-db';
import { bestEffortStorageWrite, boundedStorageRead } from '../safe-storage';

export async function putLocalAccountSecretRow(
  secret: LocalAccountSecret,
): Promise<void> {
  await bestEffortStorageWrite(() =>
    browserDb().localAccountSecrets.put(secret),
  );
}

export async function readLocalAccountSecretRow(
  accountId: string,
  fallback: LocalAccountSecret | undefined,
): Promise<LocalAccountSecret | undefined> {
  return boundedStorageRead(
    () => browserDb().localAccountSecrets.get(accountId),
    fallback,
  );
}

export async function deleteLocalAccountSecretRow(
  accountId: string,
): Promise<void> {
  await bestEffortStorageWrite(() =>
    browserDb().localAccountSecrets.delete(accountId),
  );
}
