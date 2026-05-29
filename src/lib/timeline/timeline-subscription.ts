import type { RelaySet } from '../relays/relay-store';
import {
  selectedUserReadRelays,
  selectedUserWriteRelays,
  sortedRelayUrls,
} from '../relays/relay-selection';
import { childRelaySubscriptionId } from '../relays/subscription-id';

export function timelineRelays(relaySets: readonly RelaySet[]): string[] {
  return selectedUserReadRelays(relaySets);
}

export function enabledWriteRelays(relaySets: readonly RelaySet[]): string[] {
  return selectedUserWriteRelays(relaySets);
}

export function relayRuntimeKey(relays: readonly string[]): string {
  return sortedRelayUrls(relays).join('\u0000');
}

export function createTimelineSubId(tabId: string, prefix = 'tl'): string {
  const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  return childRelaySubscriptionId(prefix, nonce, tabId);
}
