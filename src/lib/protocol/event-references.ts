import { decodeEntity } from './nip19';
import { kinds } from './kinds';
import { replyParent, replyRoot } from './tags';
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
  readonly relays?: readonly string[];
  readonly authorPubkey?: string;
  readonly marker?: string;
  readonly source?: 'e' | 'q' | 'content' | 'repost' | 'reaction' | 'deletion';
};

export function eventReferences(event: NostrEvent): EventReference[] {
  const refs: EventReference[] = [];
  if (event.kind === kinds.repost) {
    pushEventTag(refs, 'repost', event.tags.filter(isETag).at(-1), 'repost');
    return dedupe(refs);
  }
  if (event.kind === kinds.genericRepost) {
    pushEventTag(refs, 'repost', event.tags.filter(isETag).at(-1), 'repost');
    return dedupe(refs);
  }
  if (event.kind === kinds.reaction) {
    pushEventTag(
      refs,
      'reaction',
      event.tags.filter(isETag).at(-1),
      'reaction',
    );
    return dedupe(refs);
  }
  if (event.kind === kinds.deletion) {
    for (const tag of event.tags.filter(isETag))
      pushEventTag(refs, 'deletion', tag, 'deletion');
    return dedupe(refs);
  }
  for (const tag of event.tags.filter(isETag)) {
    if (tag[3] === 'root') pushEventTag(refs, 'reply-root', tag, 'e');
    if (tag[3] === 'reply') pushEventTag(refs, 'reply-parent', tag, 'e');
  }
  if (!refs.some((ref) => ref.kind === 'reply-root'))
    push(refs, 'reply-root', replyRoot(event), { source: 'e' });
  if (!refs.some((ref) => ref.kind === 'reply-parent'))
    push(refs, 'reply-parent', replyParent(event), { source: 'e' });
  for (const tag of event.tags.filter((tag) => tag[0] === 'q'))
    push(refs, 'quote', tag[1], {
      relays: tag[2] ? [tag[2]] : [],
      source: 'q',
    });
  refs.push(...nostrEventReferences(event.content));
  return dedupe(refs);
}

export function verifiedNestedRepost(
  event: NostrEvent,
): NostrEvent | undefined {
  const repost =
    event.kind === kinds.repost || event.kind === kinds.genericRepost;
  if (!repost || !event.content.trim()) return undefined;
  try {
    const parsed = parseNostrEvent(JSON.parse(event.content));
    if (!parsed.ok) return undefined;
    const verified = verifyEvent(parsed.event);
    return verified.ok && repostTargetMatchesSource(event, verified.event)
      ? verified.event
      : undefined;
  } catch {
    return undefined;
  }
}

function repostTargetMatchesSource(
  source: NostrEvent,
  target: NostrEvent,
): boolean {
  if (source.kind === kinds.repost)
    return (
      target.kind === kinds.textNote && lastEventTagId(source) === target.id
    );
  if (source.kind === kinds.genericRepost) {
    const declared = lastEventTagId(source);
    return !declared || declared === target.id;
  }
  return false;
}

function lastEventTagId(event: NostrEvent): string | undefined {
  const id = event.tags.filter(isETag).at(-1)?.[1];
  return id && isEventId(id) ? id : undefined;
}

function nostrEventReferences(content: string): EventReference[] {
  return [...content.matchAll(/\bnostr:([a-z0-9]+)/gi)].flatMap((match) => {
    const decoded = decodeEntity(match[1] ?? '');
    if (!decoded) return [];
    if (decoded.type === 'note' && isEventId(decoded.data))
      return [{ kind: 'nostr-event', id: decoded.data, source: 'content' }];
    if (decoded.type === 'nevent' && isEventId(decoded.data.id))
      return [
        {
          kind: 'nostr-event',
          id: decoded.data.id,
          relays: decoded.data.relays ?? [],
          authorPubkey: decoded.data.author,
          source: 'content',
        },
      ];
    return [];
  });
}

function push(
  refs: EventReference[],
  kind: EventReferenceKind,
  id: string | undefined,
  patch: Partial<EventReference> = {},
): void {
  if (id && isEventId(id)) refs.push(cleanReference({ kind, id, ...patch }));
}

function pushEventTag(
  refs: EventReference[],
  kind: EventReferenceKind,
  tag: readonly string[] | undefined,
  source: EventReference['source'],
): void {
  push(refs, kind, tag?.[1], {
    relays: tag?.[2] ? [tag[2]] : [],
    marker: tag?.[3],
    authorPubkey: tag?.[4],
    source,
  });
}

function dedupe(refs: readonly EventReference[]): EventReference[] {
  const byId = new Map<string, EventReference>();
  for (const ref of refs) {
    const existing = byId.get(ref.id);
    byId.set(ref.id, existing ? mergeRef(existing, ref) : ref);
  }
  return [...byId.values()];
}

function mergeRef(a: EventReference, b: EventReference): EventReference {
  return cleanReference({
    ...a,
    relays: [...new Set([...(a.relays ?? []), ...(b.relays ?? [])])],
    authorPubkey: a.authorPubkey ?? b.authorPubkey,
    marker: a.marker ?? b.marker,
  });
}

function isETag(tag: readonly string[]): boolean {
  return tag[0] === 'e';
}

function cleanReference(reference: EventReference): EventReference {
  return Object.fromEntries(
    Object.entries(reference).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== undefined,
    ),
  ) as EventReference;
}
