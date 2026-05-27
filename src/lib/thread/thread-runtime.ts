import { feedPageSize, threadWindowSize } from '../events/feed-window';
import { lookupEvent } from '../events/repository';
import type { PoolEvent, RelayPool } from '../relays/relay-pool';
import type { DemandVisibility } from '../relays/orchestration/demand-types';
import type { SubscriptionOrchestrator } from '../relays/orchestration/orchestrator';
import { runtimeSubscriptions } from '../relays/runtime-subscriptions';
import { replyRoot } from '../protocol';
import { mergeThreadItems, type ThreadItem } from './thread-store';
import {
  runThreadLoadNewer,
  runThreadLoadOlder,
  threadPagingError,
} from './thread-runtime-run-paging';
import {
  createThreadHandlers,
  threadStartCache,
  type ThreadHandlerCtx,
} from './thread-runtime-handlers';
import { threadLiveFilters } from './thread-subscription-filters';
import {
  emptyThreadState,
  withThreadCursors,
  type ThreadState,
} from './thread-state';

export type ThreadRuntime = ReturnType<typeof createThreadRuntime>;

export function createThreadRuntime(
  eventId: string,
  relays: readonly string[],
  subId = `thread:${crypto.randomUUID()}`,
  owner = subId,
  pool?: RelayPool,
  subscriptions?: SubscriptionOrchestrator,
) {
  const manager = runtimeSubscriptions(pool, subscriptions);
  let visibility: DemandVisibility = 'visible';
  let cached: ThreadItem[] = [];
  let live: ThreadItem[] = [];
  const cleanup: (() => void)[] = [];
  const aborts = new AbortController();
  const listeners = new Set<(state: ThreadState) => void>();
  const pageSize = feedPageSize;
  const startedAt = Math.floor(Date.now() / 1000);
  let state: ThreadState = emptyThreadState();
  let rootId = eventId;
  let closed = false;
  let generation = 0;

  const items = (): ThreadItem[] =>
    mergeThreadItems(cached, live).slice(0, threadWindowSize);
  const active = (run: number): boolean => !closed && generation === run;
  const emit = (next: ThreadState): void => {
    if (closed) return;
    state = withThreadCursors(next);
    listeners.forEach((listener) => listener(state));
  };
  const discoverRoot = async (): Promise<void> => {
    const selected = await lookupEvent(eventId).catch(() => undefined);
    rootId = selected ? (replyRoot(selected.event) ?? eventId) : eventId;
  };
  const handlerCtx: ThreadHandlerCtx = {
    eventId,
    rootId: () => rootId,
    setRootId: (id) => (rootId = id),
    relays,
    owner,
    subId,
    pageSize,
    subscriptions: manager,
    signal: aborts.signal,
    threadWindowSize,
    isClosed: () => closed,
    isActive: active,
    getGeneration: () => generation,
    items,
    getCached: () => cached,
    setCached: (v) => (cached = v),
    getLive: () => live,
    setLive: (v) => (live = v),
    getState: () => state,
    emit,
  };
  const handlers = createThreadHandlers(handlerCtx);
  const pagingCtx = {
    eventId,
    rootId: () => rootId,
    owner,
    items,
    relays,
    pageSize,
    subscriptions: manager,
    signal: aborts.signal,
    setCached: (v: ThreadItem[]) => (cached = v),
    clearLive: () => (live = []),
    state,
    emit,
  };
  const runtime = {
    subscribe: (listener: (state: ThreadState) => void): (() => void) => {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    start: async (): Promise<void> => {
      if (closed) return;
      const run = ++generation;
      await threadStartCache(handlerCtx, discoverRoot);
      if (!active(run)) return;
      if (relays.length === 0) {
        emit({ ...state, loading: false, error: 'No enabled read relays.' });
        return;
      }
      cleanup.push(
        manager.subscribeState(handlers.receiveState),
        manager.submitLiveIntent(
          {
            surface: 'thread',
            owner,
            channel: 'thread:replies',
            visibility,
            selectedRelays: relays,
            filters: threadLiveFilters(eventId, rootId, startedAt, pageSize),
            purpose: 'feed',
            since: startedAt,
          },
          relays,
          (event: PoolEvent) => void handlers.receive(event),
        ),
      );
      void handlers.loadInitialPage();
    },
    setVisibility: (visible: boolean): void => {
      visibility = visible ? 'visible' : 'hidden';
      if (visible) manager.resumeOwner(owner);
      else manager.pauseOwner(owner);
    },
    close: (): void => {
      closed = true;
      generation++;
      aborts.abort();
      manager.releaseOwner(owner);
      for (const item of cleanup.splice(0)) item();
      listeners.clear();
    },
    loadOlder: async (): Promise<void> => {
      if (closed || state.loadingOlder || !state.hasOlder) return;
      const run = generation;
      const cursor = state.oldestCursor;
      if (!cursor) return;
      emit({ ...state, loadingOlder: true });
      try {
        await runThreadLoadOlder({ ...pagingCtx, rootId, cursor, state });
        if (!active(run)) return;
      } catch (error) {
        emit(threadPagingError(error, state));
      } finally {
        if (state.loadingOlder) emit({ ...state, loadingOlder: false });
      }
    },
    loadNewer: async (): Promise<void> => {
      if (closed || state.loadingNewer || !state.hasNewer) return;
      const run = generation;
      const cursor = state.newestCursor;
      if (!cursor) return;
      emit({ ...state, loadingNewer: true });
      try {
        await runThreadLoadNewer({ ...pagingCtx, rootId, cursor, state });
        if (!active(run)) return;
      } catch (error) {
        emit(threadPagingError(error, state));
      } finally {
        if (state.loadingNewer) emit({ ...state, loadingNewer: false });
      }
    },
    items,
  };
  return runtime;
}
