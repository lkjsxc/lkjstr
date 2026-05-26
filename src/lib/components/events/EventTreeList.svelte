<script lang="ts">
  import { VList } from 'virtua/svelte';
  import { onDestroy, tick } from 'svelte';
  import { isNearEnd, isNearStart } from '$lib/feed-surface/near-end';
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
  import EventTreeListRows, { type ViewRow } from './EventTreeListRows.svelte';
  import { pinVisibleEvents } from '$lib/cache/pins';
  import { actionStateForFeed } from '$lib/events/action-state';
  import { setTabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import {
    restoreFeedListAnchor,
    syncFeedListAnchor,
    type TreeListAnchorHandle,
  } from './event-tree-list-anchors';

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
    tabId?: string;
    restoreAnchor?: { readonly eventId: string; readonly offset: number };
  };

  let props: Props = $props();
  let list = $state<TreeListAnchorHandle>();
  let autoFillPending = false;
  let treeKey = '';
  let destroyed = false;
  let cachedNodes: FlatEventTreeItem[] = [];
  let nodes = $derived(treeNodes(props.items));
  let actionStates = $derived(
    actionStateForFeed(props.items, props.activeAccountPubkey),
  );
  let rows = $derived<ViewRow[]>(
    props.loadingOlder && props.hasOlder
      ? [...nodes, { loadingOlder: true }]
      : props.hasOlder === false && nodes.length > 0
        ? [...nodes, { terminal: true }]
        : nodes,
  );
  let previousNodes: FlatEventTreeItem[] = [];
  let restoredAnchorKey = $state('');

  onDestroy(() => {
    destroyed = true;
    if (props.tabId) setTabFeedAnchor(props.tabId, undefined);
  });

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
    previousNodes = syncFeedListAnchor({
      tabId: props.tabId,
      previous: previousNodes,
      nodes,
      list,
      key: eventNodeKey,
      destroyed: () => destroyed,
    });
    pinVisibleEvents(nodes.map((node) => node.event.id));
  });

  $effect(() => {
    void restoreFeedListAnchor({
      restore: props.restoreAnchor,
      nodes,
      list,
      key: eventNodeKey,
      destroyed: () => destroyed,
      restoredKey: restoredAnchorKey,
    }).then((key) => {
      if (!destroyed) restoredAnchorKey = key;
    });
  });

  async function maybeAutoFill(): Promise<void> {
    if (autoFillPending || props.loadingOlder || !props.hasOlder) return;
    autoFillPending = true;
    await tick();
    if (destroyed) return;
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (viewport > 0 && total <= viewport + 16) await props.onNearEnd?.();
    if (!destroyed) autoFillPending = false;
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
          <EventTreeListRows
            {node}
            profiles={props.profiles}
            relaySets={props.relaySets}
            activeAccountPubkey={props.activeAccountPubkey}
            reactions={props.reactions}
            reposts={props.reposts}
            {actionStates}
            openProfile={props.openProfile}
            openThread={props.openThread}
            openAuthorContext={props.openAuthorContext}
          />
        {/snippet}
      </VList>
    </div>
  {:else if !props.loading}
    <p class="event-list__empty">{props.emptyText ?? 'No events found.'}</p>
  {/if}
</div>
