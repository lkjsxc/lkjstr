import { decodeEntity } from './nip19';
import { kinds } from './kinds';
import { replyParent, replyRoot, tagValues } from './tags';
import { isEventId, parseNostrEvent, type NostrEvent } from './event';
import { verifyEvent } from './event-verify';

export type EventReferenceKind =
  | 'reply-root'
  | 'reply-parent'
  | 'quote'
  | 'repost'
  | 'reaction'
  | 'deletion'
  | 'nostr-event';

export type EventReference = {
  readonly kind: EventReferenceKind;
  readonly id: string;
};

export function eventReferences(event: NostrEvent): EventReference[] {
  const refs: EventReference[] = [];
  push(refs, 'reply-root', replyRoot(event));
  push(refs, 'reply-parent', replyParent(event));
  for (const id of tagValues(event, 'q')) push(refs, 'quote', id);
  if (event.kind === kinds.repost)
    push(refs, 'repost', tagValues(event, 'e').at(-1));
  if (event.kind === kinds.reaction)
    push(refs, 'reaction', tagValues(event, 'e').at(-1));
  if (event.kind === kinds.deletion) {
    for (const id of tagValues(event, 'e')) push(refs, 'deletion', id);
  }
  for (const id of nostrEventIds(event.content)) push(refs, 'nostr-event', id);
  return dedupe(refs);
}

export function verifiedNestedRepost(
  event: NostrEvent,
): NostrEvent | undefined {
  if (event.kind !== kinds.repost || !event.content.trim()) return undefined;
  try {
    const parsed = parseNostrEvent(JSON.parse(event.content));
    if (!parsed.ok) return undefined;
    return verifyEvent(parsed.event).ok ? parsed.event : undefined;
  } catch {
    return undefined;
  }
}

function nostrEventIds(content: string): string[] {
  return [...content.matchAll(/\bnostr:([a-z0-9]+)/gi)].flatMap((match) => {
    const decoded = decodeEntity(match[1] ?? '');
    if (!decoded) return [];
    if (decoded.type === 'note') return [decoded.data];
    if (decoded.type === 'nevent') return [decoded.data.id];
    return [];
  });
}

function push(
  refs: EventReference[],
  kind: EventReferenceKind,
  id: string | undefined,
): void {
  if (id && isEventId(id)) refs.push({ kind, id });
}

function dedupe(refs: readonly EventReference[]): EventReference[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    if (seen.has(ref.id)) return false;
    seen.add(ref.id);
    return true;
  });
}
