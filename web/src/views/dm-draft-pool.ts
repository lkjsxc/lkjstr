// Refusing a signer hides private content without discarding the tab's unsaved editor.
import type { Account } from '../engine/protocol.ts';
import { createDmDraftStore } from './dm-draft-store.ts';
import type { ViewEnv } from './registry.ts';
export function createDmDraftPool(env: ViewEnv) {
  const stores = new Map<
    string,
    { store: ReturnType<typeof createDmDraftStore>; signer: Account['signer'] }
  >(); // <=32 owned accounts
  const off = env.engine.accounts.subscribe(({ accounts }) => {
    for (const [pubkey, record] of stores) {
      const account = accounts.find((a) => a.author.pubkey === pubkey);
      if (
        !account ||
        account.locked ||
        account.signer !== record.signer ||
        account.signer === 'none'
      ) {
        record.store.dispose(true);
        stores.delete(pubkey);
      }
    }
  });
  return {
    get(account: Account, peers: readonly string[]) {
      const key = account.author.pubkey;
      let value = stores.get(key);
      if (!value) {
        const store = createDmDraftStore({
          env,
          account: key,
          recipients: peers,
          changed() {},
          failed() {},
        });
        value = { store, signer: account.signer };
        stores.set(key, value);
      }
      return value.store;
    },
    dispose(): void {
      off();
      for (const { store } of stores.values()) store.dispose();
      stores.clear();
    },
  };
}
