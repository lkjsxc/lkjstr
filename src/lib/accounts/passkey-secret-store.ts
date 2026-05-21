import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';

export type PasskeyAccountSecret = {
  readonly accountId: string;
  readonly pubkey: string;
  readonly credentialId: string;
  readonly saltLabel: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

const memorySecrets = new Map<string, PasskeyAccountSecret>();

export async function savePasskeySecret(
  secret: PasskeyAccountSecret,
): Promise<void> {
  const saved = { ...secret, updatedAt: Date.now() };
  memorySecrets.set(saved.accountId, saved);
  await bestEffortStorageWrite(() =>
    browserDb().passkeyAccountSecrets.put(saved),
  );
}

export async function getPasskeySecret(
  accountId: string,
): Promise<PasskeyAccountSecret | undefined> {
  const secret = await boundedStorageRead(
    () => browserDb().passkeyAccountSecrets.get(accountId),
    memorySecrets.get(accountId),
  );
  if (secret) memorySecrets.set(accountId, secret);
  return secret;
}

export async function listPasskeySecrets(): Promise<PasskeyAccountSecret[]> {
  const secrets = await boundedStorageRead(
    () => browserDb().passkeyAccountSecrets.toArray(),
    [...memorySecrets.values()],
  );
  secrets.forEach((secret) => memorySecrets.set(secret.accountId, secret));
  return secrets;
}

export async function removePasskeySecret(accountId: string): Promise<void> {
  memorySecrets.delete(accountId);
  await bestEffortStorageWrite(() =>
    browserDb().passkeyAccountSecrets.delete(accountId),
  );
}
