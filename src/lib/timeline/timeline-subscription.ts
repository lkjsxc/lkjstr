import {
  selectedDefaultRelaySet,
  type RelayRecord,
  type RelaySet,
} from '../relays/relay-store';
import { compactRelaySubscriptionId } from '../relays/subscription-id';

export function timelineRelays(relaySets: readonly RelaySet[]): string[] {
  return enabledRelayUrls(relaySets, (relay) => relay.read);
}

export function enabledWriteRelays(relaySets: readonly RelaySet[]): string[] {
  return enabledRelayUrls(relaySets, (relay) => relay.write);
}

export function createTimelineSubId(tabId: string, prefix = 'tl'): string {
  const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  return compactRelaySubscriptionId(prefix, nonce, tabId);
}

function enabledRelayUrls(
  relaySets: readonly RelaySet[],
  mode: (relay: RelayRecord) => boolean,
): string[] {
  const set = selectedDefaultRelaySet(relaySets);
  const relays =
    set?.relays
      .filter((relay) => relay.enabled && mode(relay))
      .map((relay) => relay.url) ?? [];
  return [...new Set(relays)];
}
