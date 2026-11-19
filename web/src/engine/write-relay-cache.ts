import { kv } from '../shared/storage.ts';
import type { Account, WriteRelayList } from './protocol.ts';

const KEY = 'write-relay-lists';
function readLists(): Record<string, WriteRelayList> {
  const raw = kv.get(KEY);
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, WriteRelayList>)
    : {};
}

/** Bounded to the 32 device accounts. Only public, resolved write routes are kept here. */
export function writeRelayCache() {
  return {
    get: (account: string): WriteRelayList | undefined => readLists()[account],
    update(accounts: readonly Account[]): void {
      const lists = readLists();
      const next: Record<string, WriteRelayList> = {};
      let changed = false;
      for (const { author, writeRelays } of accounts.slice(0, 32)) {
        const account = author.pubkey;
        const old = lists[account];
        const newer =
          writeRelays &&
          (!old ||
            writeRelays.at > old.at ||
            (writeRelays.at === old.at && writeRelays.id < old.id) ||
            (writeRelays.id === old.id &&
              old.readOnly === undefined &&
              writeRelays.readOnly !== undefined));
        const current = newer ? writeRelays : old;
        if (current) next[account] = current;
        changed ||= Boolean(newer);
      }
      if (changed || Object.keys(next).length !== Object.keys(lists).length) {
        kv.set(KEY, next);
      }
    },
  };
}
