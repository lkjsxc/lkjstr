import { boundedErrorText } from '../events/runtime-error';
import { eventInDisplayBounds } from '../events/feed-display-bounds';
import { afterCursor } from '../events/repository-shared';
import type { PoolEvent } from '../relays/relay-pool';
import type { RelaySnapshot } from '../relays/types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { threadRelayState } from './thread-relay-state';
import { loadInitialThreadPage } from './thread-runtime-pages';
import {
  cachedThreadReactions,
  cachedThreadReposts,
  mergeReactionEvent,
  mergeRepostEvent,
  storeReaction,
  storeThreadActivity,
} from './thread-reactions';
import {
  isThreadReactionKind,
  isThreadRepostKind,
} from './thread-subscription-filters';
import {
  loadCachedThread,
  mergeThreadItems,
  mergeThreadWindow,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';
import type { ThreadState } from './thread-state';

export type ThreadHandlerCtx = {
  readonly eventId: string;
  readonly rootId: () => string;
  readonly setRootId: (id: string) => void;
  readonly relays: readonly string[];
  readonly owner: string;
  readonly subId: string;
  readonly pageSize: number;
  readonly subscriptions: SubscriptionOrchestrator;
  readonly signal: AbortSignal;
  readonly threadWindowSize: number;
  readonly isClosed: () => boolean;
  readonly isActive: (run: number) => boolean;
  readonly getGeneration: () => number;
  readonly items: () => ThreadItem[];
  readonly getCached: () => ThreadItem[];
  readonly setCached: (items: ThreadItem[]) => void;
  readonly getLive: () => ThreadItem[];
  readonly setLive: (items: ThreadItem[]) => void;
  readonly getState: () => ThreadState;
  readonly emit: (next: ThreadState) => void;
};

export function createThreadHandlers(ctx: ThreadHandlerCtx) {
  const receiveReaction = async (poolEvent: PoolEvent): Promise<void> => {
    await storeReaction(poolEvent.event, poolEvent.relay);
    if (!ctx.isClosed()) {
      ctx.emit({
        ...ctx.getState(),
        reactions: mergeReactionEvent(
          ctx.getState().reactions,
          poolEvent.event,
        ),
      });
    }
  };
  const receive = async (poolEvent: PoolEvent): Promise<void> => {
    if (ctx.isClosed()) return;
    if (isThreadReactionKind(poolEvent.event.kind))
      return receiveReaction(poolEvent);
    if (isThreadRepostKind(poolEvent.event.kind)) {
      await storeThreadActivity(poolEvent.event, poolEvent.relay);
      if (!ctx.isClosed()) {
        ctx.emit({
          ...ctx.getState(),
          reposts: mergeRepostEvent(ctx.getState().reposts, poolEvent.event),
        });
      }
      return;
    }
    await storeThreadEvent(poolEvent.event, [poolEvent.relay]);
    if (ctx.isClosed()) return;
    if (!eventInDisplayBounds(poolEvent.event)) return;
    const state = ctx.getState();
    if (state.newerPruned && afterCursor(poolEvent.event, state.newestCursor)) {
      ctx.emit({ ...state, loading: false, hasNewer: true });
      return;
    }
    ctx.setLive(
      mergeThreadWindow(
        ctx.getLive(),
        [{ event: poolEvent.event, relays: [poolEvent.relay] }],
        ctx.threadWindowSize,
      ),
    );
    ctx.emit({ ...ctx.getState(), items: ctx.items(), loading: false });
  };
  const loadInitialPage = async (): Promise<void> => {
    const run = ctx.getGeneration();
    try {
      const page = await loadInitialThreadPage({
        eventId: ctx.eventId,
        rootId: ctx.rootId(),
        relays: ctx.relays,
        owner: ctx.owner,
        pageSize: ctx.pageSize,
        subscriptions: ctx.subscriptions,
        signal: ctx.signal,
      });
      if (!ctx.isActive(run)) return;
      ctx.setRootId(page.rootId);
      ctx.setCached(mergeThreadItems(ctx.items(), page.items));
      const ids = ctx.items().map((item) => item.event.id);
      const [reactions, reposts] = await Promise.all([
        cachedThreadReactions(ids),
        cachedThreadReposts(ids),
      ]);
      if (ctx.isActive(run)) {
        ctx.emit({
          ...ctx.getState(),
          items: ctx.items(),
          loading: false,
          reactions,
          reposts,
        });
      }
    } catch (error) {
      ctx.emit({
        ...ctx.getState(),
        loading: false,
        error: boundedErrorText(error),
      });
    }
  };
  const receiveState = (snapshots: RelaySnapshot[]): void => {
    if (ctx.isClosed()) return;
    const relayState = threadRelayState(snapshots, ctx.relays, ctx.subId);
    const state = ctx.getState();
    ctx.emit({
      ...state,
      eoseRelays: relayState.eoseRelays,
      loading:
        relayState.activeRelays > 0 &&
        relayState.terminalRelays >= relayState.activeRelays
          ? false
          : state.loading,
    });
  };
  return { receive, loadInitialPage, receiveState };
}

export async function threadStartCache(
  ctx: ThreadHandlerCtx,
  discoverRoot: () => Promise<void>,
): Promise<void> {
  await discoverRoot();
  const rootId = ctx.rootId();
  const cached = mergeThreadItems(
    await loadCachedThread(rootId),
    rootId === ctx.eventId ? [] : await loadCachedThread(ctx.eventId),
  );
  ctx.setCached(cached);
  ctx.emit({ ...ctx.getState(), items: cached });
}
