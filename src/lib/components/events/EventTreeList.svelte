<script lang="ts">
  import { VList } from 'virtua/svelte';
  import { isNearEnd } from '$lib/events/feed-window';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { buildEventTree, flattenEventTree } from '$lib/events/tree';
  import type { FeedEvent } from '$lib/events/types';
  import EventRow from './EventRow.svelte';

  type Props = {
    items: readonly FeedEvent[];
    profiles?: Record<string, ProfileSummary>;
    loading?: boolean;
    loadingOlder?: boolean;
    hasOlder?: boolean;
    newerPruned?: boolean;
    emptyText?: string;
    onNearEnd?: () => void | Promise<void>;
    resetToLatest?: () => void | Promise<void>;
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
    if (
      isNearEnd(offset, viewport, total) &&
      !props.loadingOlder &&
      props.hasOlder
    )
      void props.onNearEnd?.();
  }
</script>

<div class="event-list">
  {#if props.newerPruned}
    <button
      class="event-list__latest"
      type="button"
      onclick={() => props.resetToLatest?.()}
      title="Jump to latest"
    >
      Latest
    </button>
  {/if}
  {#if nodes.length > 0}
    <VList
      bind:this={list}
      data={nodes}
      style="height: 100%; min-height: 12rem;"
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
  {:else if !props.loading}
    <p>{props.emptyText ?? 'No events found.'}</p>
  {/if}
  {#if props.loadingOlder}
    <p class="event-list__status">Loading older events...</p>
  {:else if props.hasOlder === false && nodes.length > 0}
    <p class="event-list__status">End of loaded history.</p>
  {/if}
</div>
