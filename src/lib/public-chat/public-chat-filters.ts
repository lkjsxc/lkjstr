import { kinds, normalizeRelayUrl, type NostrFilter } from '$lib/protocol';
import { selectedUserReadRelays } from '$lib/relays/relay-selection';
import type { RelaySet } from '$lib/relays/relay-store';
import type {
  PublicChatChannel,
  PublicChatReadPlan,
} from './public-chat-types';

export function publicChatReadRelays(relaySets: readonly RelaySet[]): string[] {
  return selectedUserReadRelays(relaySets);
}

export function channelDiscoveryPlan(
  relaySets: readonly RelaySet[],
  limit = 50,
): PublicChatReadPlan {
  const relays = publicChatReadRelays(relaySets);
  return {
    key: `public-chat:channels:${relays.join(',')}`,
    relays,
    filters: [{ kinds: [kinds.channelCreate], limit }],
    purpose: 'feed',
  };
}

export function channelMetadataPlan(
  relaySets: readonly RelaySet[],
  channels: readonly PublicChatChannel[],
  limit = 100,
): PublicChatReadPlan | undefined {
  const ids = channels.map((channel) => channel.id);
  if (ids.length === 0) return undefined;
  const relays = publicChatReadRelays(relaySets);
  return {
    key: `public-chat:metadata:${ids.join(',')}:${relays.join(',')}`,
    relays,
    filters: [{ kinds: [kinds.channelMetadata], '#e': ids, limit }],
    purpose: 'metadata',
  };
}

export function channelMessagesPlan(
  relaySets: readonly RelaySet[],
  channel: PublicChatChannel,
  limit = 100,
): PublicChatReadPlan {
  const relays = readRelaysWithHints(relaySets, channel.relayHints, 4);
  return {
    key: `public-chat:messages:${channel.id}:${relays.join(',')}`,
    relays,
    filters: [{ kinds: [kinds.channelMessage], '#e': [channel.id], limit }],
    purpose: 'feed',
  };
}

export function ownHidePlan(
  relaySets: readonly RelaySet[],
  pubkey: string,
  messageIds: readonly string[],
): PublicChatReadPlan | undefined {
  if (messageIds.length === 0) return undefined;
  const relays = publicChatReadRelays(relaySets);
  return {
    key: `public-chat:moderation:${pubkey}:hide`,
    relays,
    filters: [
      {
        kinds: [kinds.channelHideMessage],
        authors: [pubkey],
        '#e': messageIds,
      },
    ],
    purpose: 'event-lookup',
  };
}

export function ownMutePlan(
  relaySets: readonly RelaySet[],
  pubkey: string,
  authorPubkeys: readonly string[],
): PublicChatReadPlan | undefined {
  if (authorPubkeys.length === 0) return undefined;
  const relays = publicChatReadRelays(relaySets);
  return {
    key: `public-chat:moderation:${pubkey}:mute`,
    relays,
    filters: [
      {
        kinds: [kinds.channelMuteUser],
        authors: [pubkey],
        '#p': authorPubkeys,
      },
    ],
    purpose: 'event-lookup',
  };
}

export function readRelaysWithHints(
  relaySets: readonly RelaySet[],
  hints: readonly string[],
  maxHints: number,
): string[] {
  const relays = [...publicChatReadRelays(relaySets)];
  let added = 0;
  for (const hint of hints) {
    if (added >= maxHints) break;
    const url = normalizeRelayUrl(hint);
    if (!url || relays.includes(url) || isDisabled(relaySets, url)) continue;
    relays.push(url);
    added++;
  }
  return relays;
}

function isDisabled(relaySets: readonly RelaySet[], url: string): boolean {
  return relaySets.some((set) =>
    set.relays.some((relay) => relay.url === url && !relay.enabled),
  );
}

export function hasReadRelays(plan: PublicChatReadPlan | undefined): boolean {
  return Boolean(plan?.relays.length);
}

export type PublicChatFilter = NostrFilter;
