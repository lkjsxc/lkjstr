import { normalizeRelayUrl } from '../protocol';
import { createBoundedMap } from '../fp/bounded-map';
import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';
import { relayInfoLedgerRecord } from './relay-cache-ledger';
import type { RelayInformationRecord } from './relay-info-types';

const memoryInfo = createBoundedMap<string, RelayInformationRecord>({
  maxSize: 128,
  ttlMs: 30 * 60 * 1000,
});

export async function saveRelayInformation(
  record: RelayInformationRecord,
): Promise<void> {
  memoryInfo.set(record.relayUrl, record);
  await bestEffortStorageWrite(() =>
    browserDb().transaction(
      'rw',
      browserDb().relayInformation,
      browserDb().cacheLedger,
      async () => {
        await browserDb().relayInformation.put(record);
        await browserDb().cacheLedger.put(relayInfoLedgerRecord(record));
      },
    ),
  );
}

export async function listRelayInformation(): Promise<
  RelayInformationRecord[]
> {
  const records = await boundedStorageRead(
    () =>
      browserDb()
        .relayInformation.orderBy('fetchedAt')
        .reverse()
        .limit(500)
        .toArray(),
    [...memoryInfo.values()],
  );
  return records.sort((a, b) => b.fetchedAt - a.fetchedAt);
}

export async function relayInformation(
  inputUrl: string,
): Promise<RelayInformationRecord | undefined> {
  const relayUrl = normalizeRelayUrl(inputUrl);
  if (!relayUrl) return undefined;
  return (
    memoryInfo.get(relayUrl) ??
    (await boundedStorageRead(
      () => browserDb().relayInformation.get(relayUrl),
      undefined,
    ))
  );
}

export function cachedRelayInformation(
  inputUrl: string,
): RelayInformationRecord | undefined {
  const relayUrl = normalizeRelayUrl(inputUrl);
  return relayUrl ? memoryInfo.get(relayUrl) : undefined;
}

export function clearRelayInformationMemoryForTests(): void {
  memoryInfo.clear();
}

export function relayInformationMemorySizeForTests(): number {
  return memoryInfo.size();
}
