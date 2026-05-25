import { normalizeRelayUrl } from '../protocol';
import { createBoundedMap } from '../fp/bounded-map';
import { browserDb } from '../storage/browser-db';
import {
  bestEffortStorageWrite,
  boundedStorageRead,
} from '../storage/safe-storage';

export type RelayInformationDocument = {
  readonly name?: string;
  readonly description?: string;
  readonly pubkey?: string;
  readonly contact?: string;
  readonly supported_nips?: readonly number[];
  readonly software?: string;
  readonly version?: string;
  readonly limitation?: Record<string, unknown>;
  readonly icon?: string;
  readonly banner?: string;
};

export type RelayInformationRecord = {
  readonly relayUrl: string;
  readonly fetchedAt: number;
  readonly status: 'available' | 'unavailable';
  readonly info?: RelayInformationDocument;
  readonly error?: string;
};

const memoryInfo = createBoundedMap<string, RelayInformationRecord>({
  maxSize: 128,
  ttlMs: 30 * 60 * 1000,
});

export async function fetchRelayInformation(
  inputUrl: string,
  timeoutMs = 5000,
): Promise<RelayInformationRecord> {
  const relayUrl = normalizeRelayUrl(inputUrl);
  if (!relayUrl) throw new Error('Relay URL is invalid.');
  const fetchedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(relayHttpUrl(relayUrl), {
      headers: { Accept: 'application/nostr+json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = parseRelayInformation(await response.json());
    const record = {
      relayUrl,
      fetchedAt,
      status: 'available' as const,
      info: parsed,
    };
    await saveRelayInformation(record);
    return record;
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'fetch failed';
    const record = {
      relayUrl,
      fetchedAt,
      status: 'unavailable' as const,
      error,
    };
    await saveRelayInformation(record);
    return record;
  } finally {
    clearTimeout(timer);
  }
}

export async function saveRelayInformation(
  record: RelayInformationRecord,
): Promise<void> {
  memoryInfo.set(record.relayUrl, record);
  await bestEffortStorageWrite(() => browserDb().relayInformation.put(record));
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

export function relayRequestLimit(
  requested: number,
  info: RelayInformationDocument | undefined,
): number {
  const cap = info?.limitation?.max_limit;
  if (!Number.isInteger(cap) || (cap as number) < 1)
    return Math.max(1, requested);
  return Math.max(1, Math.min(requested, cap as number));
}

export async function relayMaySupportNip50(relayUrl: string): Promise<boolean> {
  const record = await relayInformation(relayUrl);
  if (record?.status !== 'available') return true;
  const nips = record.info?.supported_nips;
  return !nips || nips.includes(50);
}

export function relayHttpUrl(relayUrl: string): string {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:';
  return url.toString();
}

export function parseRelayInformation(
  value: unknown,
): RelayInformationDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Relay information is not a JSON object.');
  const record = value as Record<string, unknown>;
  return {
    name: stringField(record.name),
    description: stringField(record.description),
    pubkey: stringField(record.pubkey),
    contact: stringField(record.contact),
    supported_nips: numberArray(record.supported_nips),
    software: stringField(record.software),
    version: stringField(record.version),
    limitation: objectField(record.limitation),
    icon: stringField(record.icon),
    banner: stringField(record.banner),
  };
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter(
    (item): item is number => Number.isInteger(item) && item >= 0,
  );
  return out.length > 0 ? out : undefined;
}

function objectField(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
