import { kinds, type NostrEvent } from '../protocol';

export type EventActionState = {
  readonly liked: boolean;
  readonly reposted: boolean;
};

export function actionStateForFeed(
  items: readonly { readonly event: NostrEvent }[],
  activePubkey?: string | null,
): Map<string, EventActionState> {
  const map = new Map<string, EventActionState>();
  if (!activePubkey) return map;
  for (const item of items) {
    const event = item.event;
    if (event.pubkey !== activePubkey) continue;
    if (event.kind === kinds.reaction && isLikeReaction(event.content)) {
      const target = taggedEventId(event);
      if (target) mergeAction(map, target, { liked: true });
    }
    if (event.kind === kinds.repost || event.kind === kinds.genericRepost) {
      const target = taggedEventId(event);
      if (target) mergeAction(map, target, { reposted: true });
    }
  }
  return map;
}

export function actionStateForEvent(
  map: Map<string, EventActionState>,
  eventId: string,
): EventActionState {
  return map.get(eventId) ?? { liked: false, reposted: false };
}

function isLikeReaction(content: string): boolean {
  return content === '+' || content === '' || content === 'heart';
}

function taggedEventId(event: NostrEvent): string | undefined {
  const tag = event.tags.find((entry) => entry[0] === 'e' && entry[1]);
  return tag?.[1];
}

function mergeAction(
  map: Map<string, EventActionState>,
  eventId: string,
  patch: Partial<EventActionState>,
): void {
  const current = map.get(eventId) ?? { liked: false, reposted: false };
  map.set(eventId, {
    liked: current.liked || Boolean(patch.liked),
    reposted: current.reposted || Boolean(patch.reposted),
  });
}
