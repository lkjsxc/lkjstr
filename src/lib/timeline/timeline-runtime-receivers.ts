import { upsertEvent } from '../events/repository';
import { isFeedDisplayKind } from '../events/feed-kinds';
import { eventInDisplayBounds } from '../events/feed-display-bounds';
import type { PoolEvent } from '../relays/relay-pool';
import { accountHomeAuthors } from './follow-list';
import { loadAccountHome } from './timeline-load';
import type { TimelineLoad } from './timeline-load';
import { storeTimelineProfile } from './timeline-profiles';
import {
  readyWithEventsState,
  upsertLive,
  type TimelineState,
} from './timeline-state';
import type { TimelineItem } from './timeline-store';

export type TimelineReceiverContext = {
  readonly closed: () => boolean;
  readonly followSubId: string;
  readonly metaSubId: string;
  readonly noteSubId: string;
  readonly pageSize: number;
  readonly getFollowList: () => TimelineLoad['followList'];
  readonly setFollowList: (value: TimelineLoad['followList']) => void;
  readonly getFollowListId: () => string;
  readonly setFollowListId: (value: string) => void;
  readonly getAuthors: () => string[];
  readonly setAuthors: (value: string[]) => void;
  readonly getProfiles: () => TimelineState['profiles'];
  readonly setProfiles: (value: TimelineState['profiles']) => void;
  readonly applyLoaded: (loaded: TimelineLoad) => void;
  readonly emit: (next: TimelineState) => void;
  readonly nextState: (patch: Partial<TimelineState>) => TimelineState;
  readonly items: () => TimelineItem[];
  readonly withCursors: (next: TimelineState) => TimelineState;
  readonly subscribeNotes: () => Promise<void>;
  readonly getState: () => TimelineState;
  readonly setLive: (value: TimelineItem[]) => void;
  readonly getLive: () => TimelineItem[];
};

export async function receiveTimelinePoolEvent(
  ctx: TimelineReceiverContext,
  poolEvent: PoolEvent,
): Promise<void> {
  if (ctx.closed()) return;
  if (poolEvent.event.kind === 3)
    return receiveTimelineFollowList(ctx, poolEvent);
  if (poolEvent.event.kind === 0)
    return receiveTimelineMetadata(ctx, poolEvent);
  if (!isFeedDisplayKind(poolEvent.event.kind)) return;
  if (!ctx.getAuthors().includes(poolEvent.event.pubkey)) return;
  await upsertEvent(poolEvent.event, [poolEvent.relay]);
  if (!eventInDisplayBounds(poolEvent.event)) return;
  ctx.setLive(upsertLive(ctx.getLive(), poolEvent.event, poolEvent.relay));
  ctx.emit(ctx.withCursors(readyWithEventsState(ctx.getState(), ctx.items())));
}

async function receiveTimelineFollowList(
  ctx: TimelineReceiverContext,
  poolEvent: PoolEvent,
): Promise<void> {
  const event = poolEvent.event;
  const current = ctx.getFollowList();
  if (
    ctx.getFollowListId() === event.id ||
    (current && current.created_at > event.created_at)
  ) {
    await upsertEvent(event, [poolEvent.relay]);
    return;
  }
  ctx.setFollowList(event);
  ctx.setFollowListId(event.id);
  ctx.setAuthors(accountHomeAuthors(event.pubkey, event));
  await upsertEvent(event, [poolEvent.relay]);
  if (ctx.closed() || ctx.getFollowListId() !== event.id) return;
  ctx.applyLoaded(await loadAccountHome(event.pubkey, event, ctx.pageSize));
  if (ctx.closed()) return;
  ctx.emit(ctx.nextState({ items: ctx.items() }));
  void ctx.subscribeNotes();
}

async function receiveTimelineMetadata(
  ctx: TimelineReceiverContext,
  poolEvent: PoolEvent,
): Promise<void> {
  if (ctx.closed() || !ctx.getAuthors().includes(poolEvent.event.pubkey))
    return;
  await upsertEvent(poolEvent.event, [poolEvent.relay]);
  if (ctx.closed()) return;
  const profile = await storeTimelineProfile(poolEvent.event);
  ctx.setProfiles({ ...ctx.getProfiles(), [poolEvent.event.pubkey]: profile });
  ctx.emit(ctx.nextState({ loading: false, error: null }));
}
