<script lang="ts">
  import { actionStateForFeed } from '$lib/events/action-state';
  import { actionCacheChangedEvent } from '$lib/events/action-cache-signal';
  import {
    applyPublishedActionState,
    loadAuthorActionStateFromCache,
    mergeActionStateMaps,
  } from '$lib/events/action-state-cache';
  import {
    scopedFeedActionOptimistic,
    type FeedActionOptimisticScope,
  } from './feed-action-states-bridge-plan';
  import type { EventActionState } from '$lib/events/action-state';
  import type { FeedEvent } from '$lib/events/types';
  import type { NostrEvent } from '$lib/protocol';

  type Props = {
    items: readonly FeedEvent[];
    activeAccountPubkey?: string | null;
    states?: Map<string, EventActionState>;
  };

  let {
    items,
    activeAccountPubkey,
    states = $bindable(new Map<string, EventActionState>()),
  }: Props = $props();
  let optimistic = new Map<string, EventActionState>();
  let optimisticScope: FeedActionOptimisticScope | undefined;

  $effect(() => {
    const pubkey = activeAccountPubkey;
    if (!pubkey) {
      optimistic = new Map();
      optimisticScope = undefined;
      states = actionStateForFeed(items, pubkey);
      return;
    }
    let cancelled = false;
    optimistic = scopedOptimistic(pubkey, items);
    const refresh = (): void => {
      const base = actionStateForFeed(items, pubkey);
      const pending = scopedOptimistic(pubkey, items);
      states = mergeActionStateMaps(base, pending);
      void loadAuthorActionStateFromCache(pubkey).then((cached) => {
        if (!cancelled)
          states = mergeActionStateMaps(
            mergeActionStateMaps(base, cached),
            pending,
          );
      });
    };
    refresh();
    if (typeof window === 'undefined')
      return () => {
        cancelled = true;
      };
    const onCache = (event: Event): void => {
      const published = (event as CustomEvent<NostrEvent>).detail;
      if (!published || published.pubkey !== pubkey) return;
      optimistic = applyPublishedActionState(
        items,
        pubkey,
        published,
        scopedOptimistic(pubkey, items),
      );
      states = mergeActionStateMaps(states, optimistic);
      refresh();
    };
    window.addEventListener(actionCacheChangedEvent, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(actionCacheChangedEvent, onCache);
    };
  });

  function scopedOptimistic(
    pubkey: string,
    visibleItems: readonly FeedEvent[],
  ): Map<string, EventActionState> {
    optimisticScope = scopedFeedActionOptimistic(
      optimisticScope,
      pubkey,
      visibleItems,
    );
    optimistic = optimisticScope.optimistic;
    return optimistic;
  }
</script>
