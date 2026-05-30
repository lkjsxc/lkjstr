import { normalizeRelayUrl } from '../protocol';
import { parseRelayInformation } from './relay-info-parse';
import { saveRelayInformation } from './relay-info-store';
import type { RelayInformationRecord } from './relay-info-types';

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
    const info = parseRelayInformation(await response.json());
    const record = { relayUrl, fetchedAt, status: 'available' as const, info };
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

export function relayHttpUrl(relayUrl: string): string {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:';
  return url.toString();
}
