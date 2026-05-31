import { kinds, normalizeRelayUrl, type NostrEvent } from '../protocol';
import {
  putRelayListSuggestionRowsWithLedger,
  readRelayListSuggestionRowsForAccount,
} from '../storage/repositories/relay-list-suggestions-store';
import { createBoundedMap } from '../fp/bounded-map';
import { relaySuggestionLedgerRecord } from './relay-cache-ledger';
import { listRelaySets, saveRelaySets, type RelayRecord } from './relay-store';

export type RelayListSuggestionRecord = {
  readonly id: string;
  readonly accountPubkey: string;
  readonly relayUrl: string;
  readonly read: boolean;
  readonly write: boolean;
  readonly sourceEventId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

export type RelayListSuggestionInput = Pick<
  RelayListSuggestionRecord,
  'relayUrl' | 'read' | 'write'
>;

const memorySuggestions = createBoundedMap<string, RelayListSuggestionRecord>({
  maxSize: 500,
});

export async function storeRelayListSuggestionsFromEvent(
  event: NostrEvent,
): Promise<RelayListSuggestionRecord[]> {
  const suggestions = parseRelayListSuggestions(event);
  if (suggestions.length === 0) return [];
  const now = Date.now();
  const records = suggestions.map((suggestion) => ({
    id: `${event.pubkey}:${suggestion.relayUrl}`,
    accountPubkey: event.pubkey,
    relayUrl: suggestion.relayUrl,
    read: suggestion.read,
    write: suggestion.write,
    sourceEventId: event.id,
    createdAt: event.created_at,
    updatedAt: now,
  }));
  for (const record of records) memorySuggestions.set(record.id, record);
  await putRelayListSuggestionRowsWithLedger(
    records,
    records.map(relaySuggestionLedgerRecord),
  );
  return records;
}

export function parseRelayListSuggestions(
  event: NostrEvent,
): RelayListSuggestionInput[] {
  if (event.kind !== kinds.relayListMetadata) return [];
  const byRelay = new Map<string, RelayListSuggestionInput>();
  for (const tag of event.tags) {
    if (tag[0] !== 'r' || !tag[1]) continue;
    const relayUrl = normalizeRelayUrl(tag[1]);
    if (!relayUrl) continue;
    const marker = tag[2];
    const read = marker !== 'write';
    const write = marker !== 'read';
    const existing = byRelay.get(relayUrl);
    byRelay.set(relayUrl, {
      relayUrl,
      read: read || Boolean(existing?.read),
      write: write || Boolean(existing?.write),
    });
  }
  return [...byRelay.values()].sort((a, b) =>
    a.relayUrl.localeCompare(b.relayUrl),
  );
}

export async function relayListSuggestionsForAccount(
  accountPubkey: string,
): Promise<RelayListSuggestionRecord[]> {
  const fallback = [...memorySuggestions.values()].filter(
    (item) => item.accountPubkey === accountPubkey,
  );
  const records = await readRelayListSuggestionRowsForAccount(
    accountPubkey,
    fallback,
  );
  return records.sort((a, b) => a.relayUrl.localeCompare(b.relayUrl));
}

export async function importRelayListSuggestion(
  setId: string,
  suggestion: RelayListSuggestionInput,
): Promise<void> {
  const relaySets = await listRelaySets();
  const next = relaySets.map((set) => {
    if (set.id !== setId) return set;
    if (set.relays.some((relay) => relay.url === suggestion.relayUrl))
      return set;
    return {
      ...set,
      relays: [...set.relays, relayRecordFromSuggestion(suggestion)],
      updatedAt: Date.now(),
    };
  });
  await saveRelaySets(next);
}

function relayRecordFromSuggestion(
  suggestion: RelayListSuggestionInput,
): RelayRecord {
  return {
    url: suggestion.relayUrl,
    label: new URL(suggestion.relayUrl).host,
    enabled: true,
    read: suggestion.read,
    write: suggestion.write,
    state: 'idle',
    updatedAt: Date.now(),
    health: { attempts: 0, successes: 0, failures: 0 },
  };
}
