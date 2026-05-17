import { defaultRelaySet } from '../relays/default-relays';
import type { RelaySet } from '../relays/relay-store';

export function timelineRelays(relaySets: readonly RelaySet[]): string[] {
  const relays = relaySets.flatMap((set) =>
    set.relays
      .filter((relay) => relay.enabled && relay.read)
      .map((relay) => relay.url),
  );
  const source =
    relays.length > 0 ? relays : defaultRelaySet.relays.map((r) => r.url);
  return [...new Set(source)];
}

export function createTimelineSubId(tabId: string): string {
  return `timeline:${tabId}:${crypto.randomUUID()}`;
}
