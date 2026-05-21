const secrets = new Map<string, string>();

export function unlockPasskeySession(
  accountId: string,
  secretKey: string,
): void {
  secrets.set(accountId, secretKey);
}

export function isPasskeyUnlocked(accountId: string): boolean {
  return secrets.has(accountId);
}

export function getUnlockedPasskeySecret(
  accountId: string,
): string | undefined {
  return secrets.get(accountId);
}

export function lockPasskeyAccount(accountId: string): void {
  secrets.delete(accountId);
}
