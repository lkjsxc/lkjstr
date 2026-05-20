import { eventsByTagValues, upsertEvent } from '../events/repository';
import type { FeedEvent } from '../events/types';
import { kinds, type NostrEvent } from '../protocol';

export type ReactionGroup = {
  readonly content: string;
  readonly count: number;
  readonly actors: readonly string[];
};

export type ReactionSummaryMap = Record<string, readonly ReactionGroup[]>;
export type RepostGroup = {
  readonly count: number;
  readonly actors: readonly string[];
};
export type RepostSummaryMap = Record<string, RepostGroup>;

export async function cachedThreadReactions(
  eventIds: readonly string[],
): Promise<ReactionSummaryMap> {
  const events = await eventsByTagValues('e', eventIds);
  const entries = [...new Set(eventIds)].map(
    (id) => [id, groupReactions(eventsFor(events, id, isReaction))] as const,
  );
  return Object.fromEntries(entries.filter(([, groups]) => groups.length > 0));
}

export async function cachedThreadReposts(
  eventIds: readonly string[],
): Promise<RepostSummaryMap> {
  const events = await eventsByTagValues('e', eventIds);
  const entries = [...new Set(eventIds)].map(
    (id) => [id, groupReposts(eventsFor(events, id, isRepost))] as const,
  );
  return Object.fromEntries(entries.filter(([, group]) => group.count > 0));
}

export async function storeReaction(
  event: NostrEvent,
  relay: string,
): Promise<void> {
  await upsertEvent(event, [relay]);
}

export async function storeThreadActivity(
  event: NostrEvent,
  relay: string,
): Promise<void> {
  await upsertEvent(event, [relay]);
}

export function mergeReactionEvent(
  map: ReactionSummaryMap,
  event: NostrEvent,
): ReactionSummaryMap {
  const target = targetEventId(event);
  if (!target) return map;
  const current = map[target] ?? [];
  return { ...map, [target]: groupReactions([...ungroup(current), event]) };
}

export function mergeRepostEvent(
  map: RepostSummaryMap,
  event: NostrEvent,
): RepostSummaryMap {
  const target = targetEventId(event);
  if (!target) return map;
  const current = map[target]?.actors ?? [];
  return { ...map, [target]: groupReposts([event, ...actorEvents(current)]) };
}

function groupReactions(events: readonly NostrEvent[]): ReactionGroup[] {
  const groups = new Map<string, Set<string>>();
  for (const event of events) {
    const key = reactionContent(event);
    const actors = groups.get(key) ?? new Set<string>();
    actors.add(event.pubkey);
    groups.set(key, actors);
  }
  return [...groups.entries()]
    .map(([content, actors]) => ({
      content,
      count: actors.size,
      actors: [...actors].sort(),
    }))
    .sort((a, b) => b.count - a.count || a.content.localeCompare(b.content));
}

function ungroup(groups: readonly ReactionGroup[]): NostrEvent[] {
  return groups.flatMap((group) =>
    group.actors.map((pubkey) => ({
      id: `${pubkey}:${group.content}`,
      pubkey,
      created_at: 0,
      kind: 7,
      tags: [],
      content: group.content,
      sig: '',
    })),
  );
}

function targetEventId(event: NostrEvent): string | undefined {
  return event.tags.find((tag) => tag[0] === 'e')?.[1];
}

function eventsFor(
  events: readonly FeedEvent[],
  target: string,
  predicate: (event: NostrEvent) => boolean,
): NostrEvent[] {
  return events
    .map((item) => item.event)
    .filter((event) => predicate(event) && targetEventId(event) === target);
}

function reactionContent(event: NostrEvent): string {
  const text = event.content.trim();
  return text || '+';
}

function isReaction(item: FeedEvent['event']): boolean {
  return item.kind === kinds.reaction;
}

function isRepost(item: FeedEvent['event']): boolean {
  return item.kind === kinds.repost || item.kind === kinds.genericRepost;
}

function groupReposts(events: readonly NostrEvent[]): RepostGroup {
  return {
    count: new Set(events.map((event) => event.pubkey)).size,
    actors: [...new Set(events.map((event) => event.pubkey))].sort(),
  };
}

function actorEvents(actors: readonly string[]): NostrEvent[] {
  return actors.map((pubkey) => ({
    id: pubkey,
    pubkey,
    created_at: 0,
    kind: kinds.repost,
    tags: [],
    content: '',
    sig: '',
  }));
}
