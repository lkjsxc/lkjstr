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
  const list = newestEvent([cachedList?.event, ...relayList]);
  const lists = list ? [list] : [];
  const addresses = parseAddresses(lists);
  const cachedSets = await cachedEmojiSets(addresses);
  const relaySets = await relayEmojiSets(addresses, input.relays);
  const sets = newestEventsByAddress([...cachedSets, ...relaySets]);
  return sortEmoji([
    ...lists.flatMap((event) => customEmojisFromEvent(event)),
    ...sets.flatMap((event) => customEmojisFromEvent(event)),
  ]);
}

function customEmojisFromEvent(event: NostrEvent): CustomEmoji[] {
  const address = emojiSetAddress(event);
  return event.tags.flatMap((tag) => {
    const emoji = customEmojiTag(tag);
    if (!emoji) return [];
    return emoji.address || !address ? [emoji] : [{ ...emoji, address }];
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
    purpose: 'metadata',
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
      limit: 1,
    })),
    pageSize: addresses.length,
    subscriptions: sharedSubscriptionManager,
    purpose: 'metadata',
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
  return dedupeBy([...items].reverse(), (item) => item.shortcode)
    .reverse()
    .sort((a, b) => a.shortcode.localeCompare(b.shortcode));
}

function newestEvent(
  events: readonly (NostrEvent | undefined)[],
): NostrEvent | undefined {
  return events
    .filter((event): event is NostrEvent => Boolean(event))
    .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))[0];
}

function newestEventsByAddress(events: readonly NostrEvent[]): NostrEvent[] {
  return dedupeBy(
    [...events]
      .filter((event) => Boolean(emojiSetAddress(event)))
      .sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id)),
    (event) => emojiSetAddress(event) ?? '',
  );
}

function emojiSetAddress(event: NostrEvent): string | undefined {
  if (event.kind !== emojiSetKind) return undefined;
  const d = event.tags.find((tag) => tag[0] === 'd')?.[1];
  const address = d ? `30030:${event.pubkey}:${d}` : undefined;
  return validCustomEmojiAddress(address) ? address : undefined;
}

export function dedupeCustomEmojiByShortcode(
  items: readonly CustomEmoji[],
): CustomEmoji[] {
  return dedupeBy([...items].reverse(), (item) => item.shortcode).sort((a, b) =>
    a.shortcode.localeCompare(b.shortcode),
  );
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
