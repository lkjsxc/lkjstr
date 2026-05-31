import {
  deleteLocalAccountSecretRow,
  putLocalAccountSecretRow,
  readLocalAccountSecretRow,
} from '../storage/repositories/secrets-store';

export type LocalAccountSecret = {
  readonly accountId: string;
  readonly pubkey: string;
  readonly secretKey: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

const memorySecrets = new Map<string, LocalAccountSecret>();

export async function saveLocalSecret(
  secret: LocalAccountSecret,
): Promise<void> {
  const saved = { ...secret, updatedAt: Date.now() };
  memorySecrets.set(saved.accountId, saved);
  await putLocalAccountSecretRow(saved);
}

export async function getLocalSecret(
  accountId: string,
): Promise<LocalAccountSecret | undefined> {
  const secret = await readLocalAccountSecretRow(
    accountId,
    memorySecrets.get(accountId),
  );
  if (secret) memorySecrets.set(accountId, secret);
  return secret;
}

export async function removeLocalSecret(accountId: string): Promise<void> {
  memorySecrets.delete(accountId);
  await deleteLocalAccountSecretRow(accountId);
}
