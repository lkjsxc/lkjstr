<script lang="ts">
  import { VList } from 'virtua/svelte';
  import { isNearEnd, isNearStart } from '$lib/events/feed-window';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { buildEventTree, flattenEventTree } from '$lib/events/tree';
  import type { FeedEvent } from '$lib/events/types';
  import EventRow from './EventRow.svelte';

  type Props = {
    items: readonly FeedEvent[];
    profiles?: Record<string, ProfileSummary>;
    loading?: boolean;
    loadingOlder?: boolean;
    loadingNewer?: boolean;
    hasOlder?: boolean;
    hasNewer?: boolean;
    emptyText?: string;
    onNearEnd?: () => void | Promise<void>;
    onNearStart?: () => void | Promise<void>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let list = $state<{
    getViewportSize?: () => number;
    getScrollSize?: () => number;
  }>();
  let nodes = $derived(flattenEventTree(buildEventTree(props.items)));

  function handleScroll(offset: number): void {
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (isNearStart(offset) && !props.loadingNewer && props.hasNewer)
      void props.onNearStart?.();
    if (
      isNearEnd(offset, viewport, total) &&
      !props.loadingOlder &&
      props.hasOlder
    )
      void props.onNearEnd?.();
  }
</script>

<div class="event-list">
  {#if nodes.length > 0}
    <div class="event-list__scroller">
      <VList
        bind:this={list}
        data={nodes}
        style="height: 100%; min-height: 0;"
        getKey={(item) => item.event.id}
        onscroll={handleScroll}
      >
        {#snippet children(node)}
          <EventRow
            item={node}
            depth={node.depth}
            profile={props.profiles?.[node.event.pubkey]}
            openProfile={props.openProfile}
            openThread={props.openThread}
          />
        {/snippet}
      </VList>
    </div>
  {:else if !props.loading}
    <p class="event-list__empty">{props.emptyText ?? 'No events found.'}</p>
  {/if}
  {#if props.hasOlder === false && nodes.length > 0}
    <p class="event-list__status">End of loaded history.</p>
  {/if}
</div>
