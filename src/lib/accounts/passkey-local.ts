import { bytesToHex } from 'nostr-tools/utils';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { createAccount, type Account } from './account';
import { parseNsec } from './local';
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
} from './passkey-webauthn';
import { unlockPasskeySession } from './passkey-session';
import { listAccounts, saveAccount, setActiveAccountId } from './account-store';

export {
  getUnlockedPasskeySecret,
  isPasskeyUnlocked,
  lockPasskeyAccount,
} from './passkey-session';

export async function createPasskeyLocalAccount(): Promise<Account> {
  return persistPasskeyAccount(generateSecretKey());
}

export async function importPasskeyLocalNsec(input: string): Promise<Account> {
  const secret = parseNsec(input);
  if (!secret) throw new Error('nsec input is invalid.');
  return persistPasskeyAccount(secret);
}

export async function unlockPasskeyAccount(account: Account): Promise<void> {
  const secret = await getPasskeySecret(account.id);
  if (!secret) throw new Error('Passkey account secret is unavailable.');
  const result = await getPasskeyPrf([secret.credentialId]);
  const plain = await decryptPasskeySecret(secret, result.prf);
  unlockPasskeySession(account.id, plain);
}

export async function loginWithPasskey(): Promise<Account> {
  const secrets = await listPasskeySecrets();
  const result = await getPasskeyPrf(secrets.map((item) => item.credentialId));
  const secret = secrets.find(
    (item) => item.credentialId === result.credentialId,
  );
  if (!secret) throw new Error('Passkey account record was not found.');
  const account = (await listAccounts()).find(
    (item) => item.id === secret.accountId,
  );
  if (!account) throw new Error('Stored passkey account is unavailable.');
  const plain = await decryptPasskeySecret(secret, result.prf);
  unlockPasskeySession(account.id, plain);
  setActiveAccountId(account.id);
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
  await savePasskeySecret({
    accountId: account.id,
    pubkey,
    credentialId: created.credentialId,
    saltLabel: passkeySaltLabel,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    createdAt: now,
    updatedAt: now,
  });
  await saveAccount(account);
  unlockPasskeySession(account.id, bytesToHex(secret));
  setActiveAccountId(account.id);
  return account;
}
