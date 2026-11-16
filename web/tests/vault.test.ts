import { afterEach, describe, expect, it } from 'vitest';
import { createMockEngine, type MockEngine } from '../src/engine/mock/engine.ts';
import { MOCK_PASSWORD, mockEncrypted } from '../src/engine/mock/vault.ts';
import type { Action, FromEngine } from '../src/engine/protocol.ts';

describe('explicit mock vault contract', () => {
  let engine: MockEngine | undefined;
  afterEach(() => engine?.dispose());
  it('imports, locks, refuses work while locked and unlocks without a new visible surface', () => {
    const messages: FromEngine[] = [];
    engine = createMockEngine(
      (message) => messages.push(message),
      () => 1700000000000,
    );
    let serial = 0;
    const act = (action: Action) => {
      const req = `vault-${++serial}`;
      engine?.handle({ t: 'act', req, action });
      return messages.find(
        (m): m is Extract<FromEngine, { t: 'result' }> => m.t === 'result' && m.req === req,
      );
    };
    const accounts = () =>
      messages.filter((m): m is Extract<FromEngine, { t: 'accounts' }> => m.t === 'accounts').at(-1)
        ?.accounts;
    const pubkey = 'ab'.repeat(32);
    expect(
      act({ a: 'account.importEncrypted', key: mockEncrypted(pubkey), password: 'wrong' })?.error
        ?.code,
    ).toBe('rejected');
    expect(
      act({ a: 'account.importEncrypted', key: mockEncrypted(pubkey), password: MOCK_PASSWORD })
        ?.ok,
    ).toBe(true);
    expect(accounts()?.find((a) => a.author.pubkey === pubkey)).toMatchObject({
      encrypted: true,
      locked: false,
    });
    const exported = act({ a: 'account.exportEncrypted', pubkey, password: MOCK_PASSWORD });
    expect(exported?.encryptedKey).toBe(mockEncrypted(pubkey));
    expect(exported?.key).toBeUndefined();
    expect(act({ a: 'account.lock', pubkey })?.ok).toBe(true);
    expect(accounts()?.find((a) => a.author.pubkey === pubkey)?.locked).toBe(true);
    expect(act({ a: 'account.key', pubkey })?.error?.code).toBe('signer-missing');
    expect(
      act({ a: 'account.exportEncrypted', pubkey, password: MOCK_PASSWORD })?.error?.code,
    ).toBe('signer-missing');
    expect(
      act({ a: 'publish', as: pubkey, what: { k: 'note', draft: { text: 'locked' } } })?.error
        ?.code,
    ).toBe('signer-missing');
    expect(act({ a: 'account.unlock', pubkey, password: 'wrong' })?.error?.code).toBe('rejected');
    expect(act({ a: 'account.unlock', pubkey, password: MOCK_PASSWORD })?.ok).toBe(true);
    expect(accounts()?.find((a) => a.author.pubkey === pubkey)?.locked).toBe(false);
    expect(
      act({ a: 'account.exportEncrypted', pubkey, password: MOCK_PASSWORD, logN: 255 })?.error
        ?.code,
    ).toBe('too-large');
    expect(act({ a: 'account.remove', pubkey })?.ok).toBe(true);
  });
});
