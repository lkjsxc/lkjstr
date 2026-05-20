import type { NostrEvent, NostrTag } from './event';
import { kinds } from './kinds';
import { replyParent, replyRoot, tagValues } from './tags';

export function replyTags(event: NostrEvent): NostrTag[] {
  const root = replyRoot(event) ?? event.id;
  const tags: NostrTag[] = [['e', root, '', 'root']];
  if (root !== event.id) tags.push(['e', event.id, '', 'reply']);
  else tags[0] = ['e', event.id, '', 'root'];
  for (const pubkey of new Set([event.pubkey, ...tagValues(event, 'p')]))
    tags.push(['p', pubkey]);
  return tags;
}

export function reactionTags(
  event: NostrEvent,
  emoji?: { shortcode: string; url: string },
): NostrTag[] {
  const tags: NostrTag[] = [
    ['e', event.id],
    ['p', event.pubkey],
  ];
  if (emoji) tags.push(['emoji', emoji.shortcode, emoji.url]);
  return tags;
}

export function repostTags(event: NostrEvent): NostrTag[] {
  const tags: NostrTag[] = [
    ['e', event.id],
    ['p', event.pubkey],
  ];
  if (event.kind !== kinds.textNote) tags.push(['k', String(event.kind)]);
  return tags;
}

export function repostKind(event: NostrEvent): number {
  return event.kind === kinds.textNote ? kinds.repost : kinds.genericRepost;
}

export function zapRequestTags(input: {
  event?: NostrEvent;
  profilePubkey?: string;
  amountMsats: number;
  relays: readonly string[];
}): NostrTag[] {
  const tags: NostrTag[] = [
    ['amount', String(input.amountMsats)],
    ...input.relays.map((relay): NostrTag => ['relays', relay]),
  ];
  if (input.event) tags.push(['e', input.event.id], ['p', input.event.pubkey]);
  else if (input.profilePubkey) tags.push(['p', input.profilePubkey]);
  return tags;
}

export function parentEventId(event: NostrEvent): string {
  return replyParent(event) ?? event.id;
}
