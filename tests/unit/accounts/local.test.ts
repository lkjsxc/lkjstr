import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  encodeNsec,
  generateSecretKey,
  getPublicKey,
  kinds,
  verifyEvent,
} from '../../../src/lib/protocol';
import {
  createLocalAccountRecord,
  parseNsec,
  signLocalEvent,
} from '../../../src/lib/accounts/local';

describe('local account signing', () => {
  afterEach(() => vi.resetModules());

  it('rejects invalid nsec input and derives public keys', () => {
    const secret = generateSecretKey();
    const nsec = encodeNsec(secret);
    expect(parseNsec('not-an-nsec')).toBeUndefined();
    expect(parseNsec(nsec)).toEqual(secret);
    const record = createLocalAccountRecord(parseNsec(nsec));
    expect(record.account.pubkey).toBe(getPublicKey(secret));
  });

  it('signs verifiable events', () => {
    const { account, secretKey } = createLocalAccountRecord();
    const event = signLocalEvent(
      {
        pubkey: account.pubkey,
        created_at: 1,
        kind: kinds.textNote,
        tags: [],
        content: 'local note',
      },
      secretKey,
    );
    expect(verifyEvent(event).ok).toBe(true);
    expect(event.pubkey).toBe(account.pubkey);
  });

  it('stores secrets separately from listed account records', async () => {
    const tables = fakeTables();
    vi.doMock('../../../src/lib/storage/browser-db', () => ({
      browserDb: () => tables,
    }));
    vi.doMock('../../../src/lib/storage/safe-storage', () => ({
      bestEffortStorageWrite: async (write: () => Promise<unknown>) => write(),
      boundedStorageRead: async (read: () => Promise<unknown>) => read(),
      safeGetItem: () => null,
      safeRemoveItem: () => undefined,
      safeSetItem: () => undefined,
    }));
    const { createLocalAccount } =
      await import('../../../src/lib/accounts/account-manager');
    const { listAccounts } =
      await import('../../../src/lib/accounts/account-store');
    const account = await createLocalAccount();
    const listed = await listAccounts();
    expect(listed).toEqual([expect.objectContaining({ id: account.id })]);
    expect(JSON.stringify(listed)).not.toContain('secretKey');
    expect(tables.localAccountSecrets.records).toHaveLength(1);
  });

  it('generates valid nsec strings', async () => {
    const { generateNsec, parseNsec } =
      await import('../../../src/lib/accounts/local');
    expect(parseNsec(generateNsec())).toBeInstanceOf(Uint8Array);
  });
});

function fakeTables() {
  const accounts = new Map<string, unknown>();
  const secrets = new Map<string, unknown>();
  const fake = {
    accounts: {
      put: async (account: { id: string }) => accounts.set(account.id, account),
      delete: async (id: string) => accounts.delete(id),
      get: async (id: string) => accounts.get(id),
      orderBy: () => ({
        reverse: () => ({ toArray: async () => [...accounts.values()] }),
      }),
    },
    localAccountSecrets: {
      records: [] as unknown[],
      put: async (secret: { accountId: string }) => {
        secrets.set(secret.accountId, secret);
        fake.localAccountSecrets.records = [...secrets.values()];
        return undefined;
      },
      delete: async (id: string) => secrets.delete(id),
      get: async (id: string) => secrets.get(id),
    },
  };
  return fake;
}
