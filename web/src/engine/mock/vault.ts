// Explicit mock-only vault fixtures. These values cannot be imported as real Nostr keys.
import type { Action, Failure, FromEngine } from '../protocol.ts';
import type { Core } from './engine.ts';

type VaultAction = Extract<
  Action,
  {
    a: 'account.importEncrypted' | 'account.unlock' | 'account.lock' | 'account.exportEncrypted';
  }
>;
type Extra = Partial<Extract<FromEngine, { t: 'result' }>>;
const PREFIX = 'mock-ncryptsec:';
export const MOCK_PASSWORD = 'mock-password';
export const mockEncrypted = (pubkey: string): string => PREFIX + pubkey;

export function vaultAct(
  core: Core,
  action: VaultAction,
  done: (extra?: Extra) => void,
  fail: (code: Failure['code']) => void,
): void {
  if ('password' in action && new TextEncoder().encode(action.password).length > 1024)
    return fail('too-large');
  if (action.a === 'account.importEncrypted') {
    const pubkey = action.key.startsWith(PREFIX) ? action.key.slice(PREFIX.length) : '';
    if (!/^[0-9a-f]{64}$/.test(pubkey) || action.password !== MOCK_PASSWORD)
      return fail('rejected');
    const error = core.who.vault(pubkey);
    if (error) return fail(error);
  } else {
    const account = core.who.list().find((a) => a.author.pubkey === action.pubkey);
    if (!account) return fail('not-found');
    if (account.signer !== 'local') return fail('unsupported');
    if (action.a === 'account.exportEncrypted') {
      if (!action.password || (action.logN ?? 16) < 16) return fail('rejected');
      if ((action.logN ?? 16) > 18) return fail('too-large');
      if (account.locked) return fail('signer-missing');
      return done({ encryptedKey: mockEncrypted(action.pubkey) });
    }
    if (!account.encrypted) return fail('unsupported');
    if (action.a === 'account.unlock' && action.password !== MOCK_PASSWORD) return fail('rejected');
    account.locked = action.a === 'account.lock';
  }
  core.accounts();
  core.resync();
  done();
}
