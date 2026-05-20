<script lang="ts">
  import { VList } from 'virtua/svelte';
  import { tick } from 'svelte';
  import { isNearEnd, isNearStart } from '$lib/events/feed-window';
  import {
    captureVirtualAnchor,
    restoreVirtualAnchor,
    type VirtualListHandle,
  } from '$lib/events/scroll-anchor';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    buildEventTree,
    flattenEventTree,
    type FlatEventTreeItem,
  } from '$lib/events/tree';
  import type { FeedEvent } from '$lib/events/types';
  import type {
    ReactionSummaryMap,
    RepostSummaryMap,
  } from '$lib/thread/thread-reactions';
  import EventRow from './EventRow.svelte';

  type Props = {
    items: readonly FeedEvent[];
    profiles?: Record<string, ProfileSummary>;
    relaySets?: readonly RelaySet[];
    reactions?: ReactionSummaryMap;
    reposts?: RepostSummaryMap;
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
  let list = $state<
    VirtualListHandle & {
      getViewportSize?: () => number;
      getScrollSize?: () => number;
    }
  >();
  let autoFillPending = false;
  let nodes = $derived(flattenEventTree(buildEventTree(props.items)));
  let previousNodes: FlatEventTreeItem[] = [];

  function handleScroll(offset: number): void {
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (isNearStart(offset) && !props.loadingNewer && props.hasNewer)
      void props.onNearStart?.();
    if (
      isNearEnd(offset, viewport, total) &&
      !props.loadingOlder &&
      props.hasOlder &&
      nodes.length > 0
    )
      void props.onNearEnd?.();
  }

  $effect(() => {
    if (nodes.length > 0 && props.hasOlder && !props.loadingOlder)
      void maybeAutoFill();
  });

  $effect(() => {
    const anchor = captureVirtualAnchor(previousNodes, nodeKey, list);
    previousNodes = nodes;
    void tick().then(() => restoreVirtualAnchor(anchor, nodes, nodeKey, list));
  });

  async function maybeAutoFill(): Promise<void> {
    if (autoFillPending || props.loadingOlder || !props.hasOlder) return;
    autoFillPending = true;
    await tick();
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (viewport > 0 && total <= viewport + 16) await props.onNearEnd?.();
    autoFillPending = false;
  }

  function nodeKey(node: (typeof nodes)[number]): string {
    return node.event.id;
  }
</script>

<div class="event-list">
  {#if nodes.length > 0}
    <div class="event-list__scroller">
      <VList
        bind:this={list}
        data={nodes}
        style="height: 100%; min-height: 0;"
        getKey={nodeKey}
        onscroll={handleScroll}
      >
        {#snippet children(node)}
          {#if 'collapsed' in node}
            <button
              type="button"
              class="thread-continuation"
              style={`--event-depth: ${node.depth}`}
              onclick={() => props.openThread?.(node.targetId)}
            >
              Continue thread ({node.hiddenCount})
            </button>
          {:else}
            <EventRow
              item={node}
              depth={node.depth}
              profile={props.profiles?.[node.event.pubkey]}
              relaySets={props.relaySets}
              reactions={props.reactions?.[node.event.id]}
              reposts={props.reposts?.[node.event.id]}
              profiles={props.profiles}
              openProfile={props.openProfile}
              openThread={props.openThread}
            />
          {/if}
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
