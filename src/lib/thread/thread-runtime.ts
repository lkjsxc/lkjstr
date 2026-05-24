import { feedPageSize, threadWindowSize } from '../events/feed-window';
import { lookupEvent } from '../events/repository';
import { afterCursor } from '../events/repository-shared';
import { boundedErrorText } from '../events/runtime-error';
import { replyRoot } from '../protocol';
import type { PoolEvent, RelayPool } from '../relays/relay-pool';
import { runtimeSubscriptions } from '../relays/runtime-subscriptions';
import { type RelaySubscriptionManager as SubscriptionManager } from '../relays/subscription-manager';
import type { RelaySnapshot } from '../relays/types';
import { threadRelayState } from './thread-relay-state';
import {
  loadCachedThread,
  mergeThreadItems,
  mergeThreadWindow,
  storeThreadEvent,
  type ThreadItem,
} from './thread-store';
import {
  loadInitialThreadPage,
  loadNewerThreadPage,
  loadOlderThreadPage,
} from './thread-runtime-pages';
import {
  isThreadReactionKind,
  isThreadRepostKind,
  threadLiveFilters,
} from './thread-subscription-filters';
import {
  cachedThreadReactions,
  cachedThreadReposts,
  mergeReactionEvent,
  mergeRepostEvent,
  storeReaction,
  storeThreadActivity,
} from './thread-reactions';
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
  pool?: RelayPool,
  subscriptions?: SubscriptionManager,
) {
  const manager = runtimeSubscriptions(pool, subscriptions);
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

  // prettier-ignore
  const items = (): ThreadItem[] => mergeThreadItems(cached, live).slice(0, threadWindowSize);
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
  // prettier-ignore
  const receiveReaction = async (poolEvent: PoolEvent): Promise<void> => {
    await storeReaction(poolEvent.event, poolEvent.relay);
    if (!closed) emit({ ...state, reactions: mergeReactionEvent(state.reactions, poolEvent.event) });
  };
  // prettier-ignore
  const receive = async (poolEvent: PoolEvent): Promise<void> => {
    if (closed || poolEvent.subId !== subId) return;
    if (isThreadReactionKind(poolEvent.event.kind)) return receiveReaction(poolEvent);
    if (isThreadRepostKind(poolEvent.event.kind)) {
      await storeThreadActivity(poolEvent.event, poolEvent.relay);
      if (!closed) emit({ ...state, reposts: mergeRepostEvent(state.reposts, poolEvent.event) });
      return;
    }
    await storeThreadEvent(poolEvent.event, [poolEvent.relay]);
    if (closed) return;
    if (state.newerPruned && afterCursor(poolEvent.event, state.newestCursor)) {
      emit({ ...state, loading: false, hasNewer: true });
      return;
    }
    live = mergeThreadWindow(live, [{ event: poolEvent.event, relays: [poolEvent.relay] }], threadWindowSize);
    emit({ ...state, items: items(), loading: false });
  };
  // prettier-ignore
  const loadInitialPage = async (): Promise<void> => {
    const run = generation;
    try {
      const page = await loadInitialThreadPage({ eventId, rootId, relays, subId, pageSize, subscriptions: manager, signal: aborts.signal });
      if (!active(run)) return;
      rootId = page.rootId;
      cached = mergeThreadItems(items(), page.items);
      const ids = items().map((item) => item.event.id);
      const [reactions, reposts] = await Promise.all([cachedThreadReactions(ids), cachedThreadReposts(ids)]);
      if (active(run)) emit({ ...state, items: items(), loading: false, reactions, reposts });
    } catch (error) {
      emit({ ...state, loading: false, error: boundedErrorText(error) });
    }
  };
  // prettier-ignore
  const receiveState = (snapshots: RelaySnapshot[]): void => {
    if (closed) return;
    const relayState = threadRelayState(snapshots, relays, subId);
    emit({ ...state, eoseRelays: relayState.eoseRelays, loading: relayState.activeRelays > 0 && relayState.terminalRelays >= relayState.activeRelays ? false : state.loading });
  };
  // prettier-ignore
  const runtime = {
    subscribe: (listener: (state: ThreadState) => void): (() => void) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    start: async (): Promise<void> => {
      if (closed) return; const run = ++generation; await discoverRoot(); if (!active(run)) return;
      cached = mergeThreadItems(await loadCachedThread(rootId), rootId === eventId ? [] : await loadCachedThread(eventId));
      if (!active(run)) return; emit({ ...state, items: cached });
      if (relays.length === 0) return emit({ ...state, loading: false, error: 'No enabled read relays.' });
      cleanup.push(manager.subscribeState(receiveState), manager.subscribeLive({ key: subId, relays, filters: threadLiveFilters(eventId, rootId, startedAt, pageSize), purpose: 'feed' }, (event) => receive(event)));
      void loadInitialPage();
    },
    close: (): void => { closed = true; generation++; aborts.abort(); for (const item of cleanup.splice(0)) item(); listeners.clear(); },
    loadOlder: async (): Promise<void> => {
      if (closed || state.loadingOlder || !state.hasOlder) return; const run = generation; const cursor = state.oldestCursor; if (!cursor) return; emit({ ...state, loadingOlder: true });
      try { const page = await loadOlderThreadPage({ eventId, rootId, items: items(), relays, subId, cursor, pageSize, subscriptions: manager, signal: aborts.signal }); if (!active(run)) return; cached = page.items; live = []; emit({ ...state, items: items(), hasOlder: page.hasOlder, hasNewer: state.hasNewer || page.pruned, newerPruned: state.newerPruned || page.pruned }); }
      catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingOlder) emit({ ...state, loadingOlder: false }); }
    },
    loadNewer: async (): Promise<void> => {
      if (closed || state.loadingNewer || !state.hasNewer) return; const run = generation; const cursor = state.newestCursor; if (!cursor) return; emit({ ...state, loadingNewer: true });
      try { const page = await loadNewerThreadPage({ eventId, rootId, items: items(), relays, subId, cursor, pageSize, subscriptions: manager, signal: aborts.signal }); if (!active(run)) return; cached = page.items; live = []; emit({ ...state, items: items(), hasNewer: page.hasNewer, hasOlder: state.hasOlder || page.pruned, newerPruned: page.hasNewer }); }
      catch (error) { emit({ ...state, error: boundedErrorText(error) }); }
      finally { if (state.loadingNewer) emit({ ...state, loadingNewer: false }); }
    },
    items,
  };
  return runtime;
}
