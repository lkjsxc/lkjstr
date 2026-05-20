import { eventsByTagValue, upsertEvent } from '../events/repository';
import type { FeedEvent } from '../events/types';
import type { NostrEvent } from '../protocol';

export type ReactionGroup = {
  readonly content: string;
  readonly count: number;
  readonly actors: readonly string[];
};

export type ReactionSummaryMap = Record<string, readonly ReactionGroup[]>;

export async function cachedThreadReactions(
  eventIds: readonly string[],
): Promise<ReactionSummaryMap> {
  const entries = await Promise.all(
    [...new Set(eventIds)].map(
      async (id) => [id, await reactionsByEvent(id)] as const,
    ),
  );
  return Object.fromEntries(entries.filter(([, groups]) => groups.length > 0));
}

export async function storeReaction(
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

async function reactionsByEvent(eventId: string): Promise<ReactionGroup[]> {
  const events = await eventsByTagValue('e', eventId);
  return groupReactions(events.map((item) => item.event).filter(isReaction));
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

function reactionContent(event: NostrEvent): string {
  const text = event.content.trim();
  return text || '+';
}

function isReaction(item: FeedEvent['event']): boolean {
  return item.kind === 7;
}
