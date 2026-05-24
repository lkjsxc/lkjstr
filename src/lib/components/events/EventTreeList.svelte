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
  import { pinVisibleEvents } from '$lib/cache/pins';

  type TerminalRow = { readonly terminal: true };
  type LoadingRow = { readonly loadingOlder: true };
  type ViewRow = FlatEventTreeItem | TerminalRow | LoadingRow;

  type Props = {
    items: readonly FeedEvent[];
    profiles?: Record<string, ProfileSummary>;
    relaySets?: readonly RelaySet[];
    activeAccountPubkey?: string | null;
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
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let list = $state<
    VirtualListHandle & {
      getViewportSize?: () => number;
      getScrollSize?: () => number;
    }
  >();
  let autoFillPending = false;
  let treeKey = '';
  let cachedNodes: FlatEventTreeItem[] = [];
  let nodes = $derived(treeNodes(props.items));
  let rows = $derived<ViewRow[]>(
    props.loadingOlder && props.hasOlder
      ? [...nodes, { loadingOlder: true }]
      : props.hasOlder === false && nodes.length > 0
        ? [...nodes, { terminal: true }]
        : nodes,
  );
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
    const anchor = captureVirtualAnchor(previousNodes, eventNodeKey, list);
    previousNodes = nodes;
    pinVisibleEvents(nodes.map((node) => node.event.id));
    void tick().then(() =>
      restoreVirtualAnchor(anchor, nodes, eventNodeKey, list),
    );
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

  function treeNodes(items: readonly FeedEvent[]): FlatEventTreeItem[] {
    const key = items.map((item) => item.event.id).join('\u0000');
    if (key === treeKey) return cachedNodes;
    treeKey = key;
    cachedNodes = flattenEventTree(buildEventTree(items));
    return cachedNodes;
  }

  function eventNodeKey(node: FlatEventTreeItem): string {
    return node.event.id;
  }

  function rowKey(row: ViewRow): string {
    if ('terminal' in row) return 'event-list-terminal';
    if ('loadingOlder' in row) return 'event-list-loading-older';
    return row.event.id;
  }
</script>

<div class="event-list">
  {#if nodes.length > 0}
    <div class="event-list__scroller">
      <VList
        bind:this={list}
        data={rows}
        style="height: 100%; min-height: 0;"
        getKey={rowKey}
        onscroll={handleScroll}
      >
        {#snippet children(node)}
          {#if 'terminal' in node}
            <p class="event-list__status">End of loaded history.</p>
          {:else if 'loadingOlder' in node}
            <p class="event-list__status">Loading older events...</p>
          {:else if 'collapsed' in node}
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
              activeAccountPubkey={props.activeAccountPubkey}
              reactions={props.reactions?.[node.event.id]}
              reposts={props.reposts?.[node.event.id]}
              profiles={props.profiles}
              openProfile={props.openProfile}
              openThread={props.openThread}
              openAuthorContext={props.openAuthorContext}
            />
          {/if}
        {/snippet}
      </VList>
    </div>
  {:else if !props.loading}
    <p class="event-list__empty">{props.emptyText ?? 'No events found.'}</p>
  {/if}
</div>
