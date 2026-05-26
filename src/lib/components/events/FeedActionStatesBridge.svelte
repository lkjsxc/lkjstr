<script lang="ts">
  import { actionStateForFeed } from '$lib/events/action-state';
  import { actionCacheChangedEvent } from '$lib/events/action-cache-signal';
  import {
    applyPublishedActionState,
    loadAuthorActionStateFromCache,
    mergeActionStateMaps,
  } from '$lib/events/action-state-cache';
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

  $effect(() => {
    const pubkey = activeAccountPubkey;
    if (!pubkey) {
      states = actionStateForFeed(items, pubkey);
      return;
    }
    let cancelled = false;
    const refresh = (): void => {
      const base = actionStateForFeed(items, pubkey);
      states = base;
      void loadAuthorActionStateFromCache(pubkey).then((cached) => {
        if (!cancelled) states = mergeActionStateMaps(base, cached);
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
      states = applyPublishedActionState(items, pubkey, published, states);
      refresh();
    };
    window.addEventListener(actionCacheChangedEvent, onCache);
    return () => {
      cancelled = true;
      window.removeEventListener(actionCacheChangedEvent, onCache);
    };
  });
</script>
