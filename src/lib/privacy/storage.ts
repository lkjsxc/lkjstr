import {
  safeGetItem,
  safeLocalStorage,
  safeRemoveItem,
  safeSetItem,
} from '$lib/storage/safe-storage';
import { normalizePrivacyRecord, type PrivacyConsentRecord } from './consent';

export const privacyConsentKey = 'lkjstr.privacy.consent.v1';
export const optionalStoragePrefix = 'lkjstr.optional.';
export const optionalCookiePrefix = 'lkjstr_optional_';

export function loadPrivacyConsent(): PrivacyConsentRecord | undefined {
  const raw = safeGetItem(privacyConsentKey);
  if (!raw) return undefined;
  try {
    return normalizePrivacyRecord(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export function savePrivacyConsent(record: PrivacyConsentRecord): boolean {
  return safeSetItem(privacyConsentKey, JSON.stringify(record));
}

export function clearPrivacyConsent(): boolean {
  return safeRemoveItem(privacyConsentKey);
}

export function clearOptionalPrivacyData(): void {
  clearOptionalLocalStorage();
  clearOptionalCookies();
}

function clearOptionalLocalStorage(): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  const keys = Array.from({ length: storage.length }, (_, index) =>
    storage.key(index),
  ).filter((key): key is string =>
    Boolean(key?.startsWith(optionalStoragePrefix)),
  );
  for (const key of keys) storage.removeItem(key);
}

function clearOptionalCookies(): void {
  if (typeof document === 'undefined') return;
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim();
    if (!name?.startsWith(optionalCookiePrefix)) continue;
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}
