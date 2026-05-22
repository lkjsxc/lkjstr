import type { NostrEvent, NostrTag } from './event';
import { kinds } from './kinds';
import { customEmojiTagParts, type CustomEmoji } from './nip30';
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
  emoji?: CustomEmoji,
): NostrTag[] {
  const tags: NostrTag[] = [
    ['e', event.id],
    ['p', event.pubkey],
    ['k', String(event.kind)],
  ];
  if (emoji) tags.push(customEmojiTagParts(emoji));
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
  recipientPubkey?: string;
  amountMsats: number;
  lnurl: string;
  relays: readonly string[];
}): NostrTag[] {
  const tags: NostrTag[] = [
    ['relays', ...input.relays],
    ['amount', String(input.amountMsats)],
    ['lnurl', input.lnurl],
  ];
  if (input.event)
    tags.push(
      ['e', input.event.id],
      ['p', input.recipientPubkey ?? input.event.pubkey],
      ['k', String(input.event.kind)],
    );
  else if (input.profilePubkey) tags.push(['p', input.profilePubkey]);
  return tags;
}

export function parentEventId(event: NostrEvent): string {
  return replyParent(event) ?? event.id;
}
