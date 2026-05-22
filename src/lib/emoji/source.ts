import {
  customEmojiTag,
  validCustomEmojiAddress,
  type CustomEmoji,
  type NostrEvent,
} from '../protocol';
import {
  eventsMatching,
  latestEventByAuthorKind,
  upsertEvent,
} from '../events/repository';
import { readRelayPage } from '../events/relay-page';
import { sharedSubscriptionManager } from '../relays/subscription-manager';

export const emojiListKind = 10030;
export const emojiSetKind = 30030;

type EmojiAddress = {
  readonly address: string;
  readonly pubkey: string;
  readonly d: string;
};

export async function loadAccountEmojiSource(input: {
  readonly pubkey?: string;
  readonly relays: readonly string[];
}): Promise<CustomEmoji[]> {
  if (!input.pubkey) return [];
  const cachedList = await latestEventByAuthorKind(input.pubkey, emojiListKind);
  const relayList = await relayEmojiList(input.pubkey, input.relays);
  const lists = [cachedList?.event, ...relayList].filter(
    (event): event is NostrEvent => Boolean(event),
  );
  const addresses = parseAddresses(lists);
  const cachedSets = await cachedEmojiSets(addresses);
  const relaySets = await relayEmojiSets(addresses, input.relays);
  return sortEmoji([
    ...lists.flatMap((event) => customEmojisFromEvent(event)),
    ...cachedSets.flatMap((event) => customEmojisFromEvent(event)),
    ...relaySets.flatMap((event) => customEmojisFromEvent(event)),
  ]);
}

function customEmojisFromEvent(event: NostrEvent): CustomEmoji[] {
  return event.tags.flatMap((tag) => {
    const emoji = customEmojiTag(tag);
    return emoji ? [emoji] : [];
  });
}

async function relayEmojiList(
  pubkey: string,
  relays: readonly string[],
): Promise<NostrEvent[]> {
  if (relays.length === 0) return [];
  const hits = await readRelayPage({
    key: `emoji-list:${pubkey.slice(0, 12)}`,
    relays,
    filters: [{ kinds: [emojiListKind], authors: [pubkey], limit: 1 }],
    pageSize: 1,
    subscriptions: sharedSubscriptionManager,
  });
  await Promise.all(hits.map((hit) => upsertEvent(hit.event, [hit.relay])));
  return hits.map((hit) => hit.event);
}

async function cachedEmojiSets(
  addresses: readonly EmojiAddress[],
): Promise<NostrEvent[]> {
  const filters = addresses.map((item) => ({
    kinds: [emojiSetKind],
    authors: [item.pubkey],
    '#d': [item.d],
  }));
  return (await eventsMatching(filters)).map((item) => item.event);
}

async function relayEmojiSets(
  addresses: readonly EmojiAddress[],
  relays: readonly string[],
): Promise<NostrEvent[]> {
  if (addresses.length === 0 || relays.length === 0) return [];
  const hits = await readRelayPage({
    key: `emoji-sets:${addresses.map((item) => item.address).join('|')}`,
    relays,
    filters: addresses.map((item) => ({
      kinds: [emojiSetKind],
      authors: [item.pubkey],
      '#d': [item.d],
    })),
    pageSize: addresses.length,
    subscriptions: sharedSubscriptionManager,
  });
  await Promise.all(hits.map((hit) => upsertEvent(hit.event, [hit.relay])));
  return hits.map((hit) => hit.event);
}

function parseAddresses(events: readonly NostrEvent[]): EmojiAddress[] {
  return dedupeBy(
    events
      .flatMap((event) => event.tags)
      .filter((tag) => tag[0] === 'a')
      .map((tag) => parseAddress(tag[1] ?? ''))
      .filter((item): item is EmojiAddress => Boolean(item)),
    (item) => item.address,
  );
}

function parseAddress(address: string): EmojiAddress | undefined {
  if (!validCustomEmojiAddress(address)) return undefined;
  const [, pubkey = '', d = ''] = address.split(':');
  return { address, pubkey, d };
}

function sortEmoji(items: readonly CustomEmoji[]): CustomEmoji[] {
  return dedupeBy(
    items,
    (item) => `${item.shortcode}\u0000${item.url}\u0000${item.address ?? ''}`,
  ).sort((a, b) => a.shortcode.localeCompare(b.shortcode));
}

function dedupeBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
