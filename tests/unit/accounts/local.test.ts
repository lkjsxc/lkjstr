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
    const { createLocalAccount } =
      await import('../../../src/lib/accounts/account-manager');
    const { listAccounts } =
      await import('../../../src/lib/accounts/account-store');
    const { getLocalSecret } =
      await import('../../../src/lib/accounts/local-secret-store');

    const account = await createLocalAccount();
    const listed = await listAccounts();
    const secret = await getLocalSecret(account.id);

    expect(listed).toEqual([expect.objectContaining({ id: account.id })]);
    expect(JSON.stringify(listed)).not.toContain('secretKey');
    expect(secret).toEqual(expect.objectContaining({ accountId: account.id }));
  });

  it('generates valid nsec strings', async () => {
    const { generateNsec, parseNsec } =
      await import('../../../src/lib/accounts/local');
    expect(parseNsec(generateNsec())).toBeInstanceOf(Uint8Array);
  });
});
