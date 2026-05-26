import type { NostrEvent } from '../protocol';
import { isActionKind } from './action-cache-signal';
import { allMemoryEvents } from './repository-memory';
import { actionStateForFeed, type EventActionState } from './action-state';
import { loadActionStateIndex } from './action-state-index';

export async function loadAuthorActionStateFromCache(
  pubkey: string,
): Promise<Map<string, EventActionState>> {
  const byId = new Map<string, NostrEvent>();
  for (const event of allMemoryEvents()) {
    if (event.pubkey === pubkey && isActionKind(event.kind))
      byId.set(event.id, event);
  }
  const memory = actionStateForFeed(
    [...byId.values()].map((event) => ({ event })),
    pubkey,
  );
  const indexed = await loadActionStateIndex(pubkey);
  return mergeActionStateMaps(memory, indexed);
}

export function applyPublishedActionState(
  items: readonly { readonly event: NostrEvent }[],
  pubkey: string,
  published: NostrEvent,
  current: Map<string, EventActionState>,
): Map<string, EventActionState> {
  const base = actionStateForFeed(items, pubkey);
  const patch = actionStateForFeed([{ event: published }], pubkey);
  return mergeActionStateMaps(mergeActionStateMaps(base, patch), current);
}

export function mergeActionStateMaps(
  base: Map<string, EventActionState>,
  extra: Map<string, EventActionState>,
): Map<string, EventActionState> {
  if (extra.size === 0) return base;
  const merged = new Map(base);
  for (const [eventId, state] of extra) {
    const current = merged.get(eventId) ?? { liked: false, reposted: false };
    merged.set(eventId, {
      liked: current.liked || state.liked,
      reposted: current.reposted || state.reposted,
    });
  }
  return merged;
}
