import { bytesToHex } from 'nostr-tools/utils';
import { getPublicKey } from 'nostr-tools/pure';
import { createAccount, type Account } from './account';
import { parseNsec } from './local';
import {
  decodePortablePasskeyBlob,
  encodePortablePasskeyBlob,
} from './passkey-portable';
import { decryptPasskeySecret, encryptPasskeySecret } from './passkey-crypto';
import {
  getPasskeySecret,
  listPasskeySecrets,
  savePasskeySecret,
} from './passkey-secret-store';
import {
  createPasskeyPrf,
  getPasskeyPrf,
  passkeySaltLabel,
  readDiscoverablePasskeyLargeBlob,
  writePasskeyLargeBlob,
} from './passkey-webauthn';
import { unlockPasskeySession } from './passkey-session';
import { listAccounts, saveAccount, setActiveAccountId } from './account-store';
import type { PasskeyAccountSecret } from './passkey-secret-store';

export {
  getUnlockedPasskeySecret,
  isPasskeyUnlocked,
  lockPasskeyAccount,
} from './passkey-session';

export async function createPasskeyLocalAccount(
  input: string,
): Promise<Account> {
  const secret = parseNsec(input);
  if (!secret) throw new Error('nsec input is invalid.');
  return persistPasskeyAccount(secret);
}

export const importPasskeyLocalNsec = createPasskeyLocalAccount;

export async function unlockPasskeyAccount(account: Account): Promise<void> {
  const secret = await getPasskeySecret(account.id);
  if (!secret) throw new Error('Passkey account secret is unavailable.');
  const result = await getPasskeyPrf([secret.credentialId]);
  const plain = await decryptPasskeySecret(secret, result.prf);
  unlockPasskeySession(account.id, plain);
}

export async function loginWithPasskey(): Promise<Account> {
  const secrets = await listPasskeySecrets();
  const { secret, prf } = secrets.length
    ? await chooseStoredSecret(secrets)
    : await readPortableSecret();
  const plain = await decryptPasskeySecret(secret, prf);
  const account = await restorePasskeyAccount(secret);
  unlockPasskeySession(account.id, plain);
  setActiveAccountId(account.id);
  return account;
}

async function chooseStoredSecret(
  secrets: readonly PasskeyAccountSecret[],
): Promise<{ secret: PasskeyAccountSecret; prf: Uint8Array }> {
  const result = await getPasskeyPrf(secrets.map((item) => item.credentialId));
  const secret = secrets.find(
    (item) => item.credentialId === result.credentialId,
  );
  if (!secret) throw new Error('Passkey account record was not found.');
  return { secret, prf: result.prf };
}

async function readPortableSecret(): Promise<{
  secret: PasskeyAccountSecret;
  prf: Uint8Array;
}> {
  const portable = await readDiscoverablePasskeyLargeBlob();
  const decoded = decodePortablePasskeyBlob(portable.blob);
  const secret = { ...decoded, credentialId: portable.credentialId };
  await savePasskeySecret(secret);
  const result = await getPasskeyPrf([secret.credentialId]);
  return { secret, prf: result.prf };
}

async function restorePasskeyAccount(
  secret: PasskeyAccountSecret,
): Promise<Account> {
  const existing = (await listAccounts()).find(
    (item) => item.id === secret.accountId,
  );
  if (existing) return existing;
  const account = {
    ...createAccount(
      secret.pubkey,
      'passkey-local',
      `Passkey ${secret.pubkey.slice(0, 8)}`,
    ),
    id: secret.accountId,
  };
  await saveAccount(account);
  return account;
}

async function persistPasskeyAccount(secret: Uint8Array): Promise<Account> {
  const pubkey = getPublicKey(secret);
  const account = createAccount(
    pubkey,
    'passkey-local',
    `Passkey ${pubkey.slice(0, 8)}`,
  );
  const created = await createPasskeyPrf({
    accountId: account.id,
    pubkey,
    label: account.label,
  });
  const encrypted = await encryptPasskeySecret(bytesToHex(secret), created.prf);
  const now = Date.now();
  const record = {
    accountId: account.id,
    pubkey,
    credentialId: created.credentialId,
    saltLabel: passkeySaltLabel,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    createdAt: now,
    updatedAt: now,
  };
  await writePasskeyLargeBlob(
    created.credentialId,
    encodePortablePasskeyBlob(record),
  );
  await savePasskeySecret(record);
  await saveAccount(account);
  unlockPasskeySession(account.id, bytesToHex(secret));
  setActiveAccountId(account.id);
  return account;
}
