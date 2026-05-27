import { normalizeRelayUrl } from '../protocol';

const homeStartedAtByKey = new Map<string, number>();

/** Shared live-window anchor so multiple Home tabs share one notes lease. */
export function timelineSessionStartedAt(
  surface: 'home' | 'global',
  accountPubkey: string | undefined,
  relays: readonly string[],
): number {
  if (surface !== 'home') return Math.floor(Date.now() / 1000);
  const relayKey = relays
    .map(normalizeRelayUrl)
    .filter((url): url is string => Boolean(url))
    .sort()
    .join('\u0000');
  const key = `${accountPubkey ?? ''}|${relayKey}`;
  let startedAt = homeStartedAtByKey.get(key);
  if (startedAt === undefined) {
    startedAt = Math.floor(Date.now() / 1000);
    homeStartedAtByKey.set(key, startedAt);
  }
  return startedAt;
}
