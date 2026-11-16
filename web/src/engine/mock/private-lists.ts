// Explicit fixture lists are already projected; this mock never claims to decrypt ciphertext.
import type { FromEngine, Query, SubState } from '../protocol.ts';
import type { createAccounts } from './accounts.ts';
import type { Core } from './engine.ts';
import { MOCK_ZAP_EVIDENCE } from './zaps.ts';
export function privateListState(query: Query): Pick<SubState, 'privateLists'> {
  return query.privateLists ? { privateLists: { phase: 'ready', pending: 0, failed: 0 } } : {};
}
export function privateListAccountSnapshot(
  who: ReturnType<typeof createAccounts>,
  unread: number,
): FromEngine {
  return {
    t: 'accounts',
    active: who.active(),
    accounts: who.list().map((account, index) => ({
      ...account,
      unread: index === 0 ? unread : 0,
      unreadZap: MOCK_ZAP_EVIDENCE,
      privateLists: { phase: 'ready', pending: 0, failed: 0 },
    })),
  };
}
export function retryLists(core: Core, req: string, pubkey: string): void {
  const account = core.who.list().find((a) => a.author.pubkey === pubkey);
  const code = !account
    ? 'signed-out'
    : account.signer === 'none'
      ? 'read-only'
      : account.locked
        ? 'signer-missing'
        : undefined;
  if (code) {
    core.post({ t: 'result', req, ok: false, error: { code } });
    return;
  }
  core.post({ t: 'result', req, ok: true });
}
