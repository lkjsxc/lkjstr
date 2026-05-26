import { browserDb } from '../storage/browser-db';
import { kinds, type NostrEvent } from '../protocol';
import { isActionKind } from './action-cache-signal';
import { allMemoryEvents } from './repository-memory';
import { normalizeStoredEvent } from './normalize';
import { actionStateForFeed, type EventActionState } from './action-state';

const actionKinds = [
  kinds.reaction,
  kinds.repost,
  kinds.genericRepost,
] as const;

export async function loadAuthorActionStateFromCache(
  pubkey: string,
  limit = 800,
): Promise<Map<string, EventActionState>> {
  const byId = new Map<string, NostrEvent>();
  for (const event of allMemoryEvents()) {
    if (event.pubkey === pubkey && isActionKind(event.kind))
      byId.set(event.id, event);
  }
  for (const kind of actionKinds) {
    const rows = await browserDb()
      .events.where('[pubkey+kind+created_at]')
      .between([pubkey, kind, 0], [pubkey, kind, Number.MAX_SAFE_INTEGER])
      .reverse()
      .limit(limit)
      .toArray();
    for (const row of rows) {
      const event = normalizeStoredEvent(row);
      byId.set(event.id, event);
    }
  }
  return actionStateForFeed(
    [...byId.values()].map((event) => ({ event })),
    pubkey,
  );
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
