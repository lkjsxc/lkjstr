<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { isNearEnd, isNearStart } from '$lib/feed-surface/near-end';
  import { footerPhaseFromPaging } from '$lib/feed-surface/footer-phase';
  import FeedScrollSurface from '$lib/components/feed/FeedScrollSurface.svelte';
  import type { FeedScrollListHandle } from '$lib/components/feed/FeedScrollSurface.svelte';
  import type { FlatEventTreeItem } from '$lib/events/tree';
  import EventTreeListRows from './EventTreeListRows.svelte';
  import {
    buildViewRows,
    eventRows,
    type EventTreeListViewRow,
    eventNodeKey,
    isRowNearStart,
    treeNodesFromItems,
    viewRowKey,
  } from './event-tree-list-helpers';
  import { pinVisibleEvents } from '$lib/cache/pins';
  import type { EventActionState } from '$lib/events/action-state';
  import FeedActionStatesBridge from './FeedActionStatesBridge.svelte';
  import { setTabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import {
    restoreFeedListAnchor,
    syncFeedListAnchor,
    type EventAnchorRow,
    type TreeListAnchorHandle,
  } from './event-tree-list-anchors';
  import type { EventTreeListProps as Props } from './event-tree-list-props';

  let props: Props = $props();
  let list = $state<FeedScrollListHandle & TreeListAnchorHandle>();
  let scrollElement = $state<HTMLElement>();
  let autoFillPending = false;
  let newerLoadPending = false;
  let destroyed = false;
  const treeCache = { key: '', nodes: [] as FlatEventTreeItem[] };
  let nodes = $derived(treeNodesFromItems(props.items, treeCache));
  let footerPhase = $derived(
    footerPhaseFromPaging({
      loadingOlder: Boolean(props.loadingOlder),
      hasOlder: props.hasOlder !== false,
      rowCount: nodes.length,
      error: props.pagingError,
    }),
  );
  let nearEndEnabled = $derived(
    props.pagingEnabled !== false &&
      nodes.length > 0 &&
      Boolean(props.hasOlder) &&
      !props.loadingOlder &&
      Boolean(props.onNearEnd),
  );
  let actionStates = $state(new Map<string, EventActionState>());
  let rows = $derived<EventTreeListViewRow[]>(
    buildViewRows(
      props.leadingRows ?? [],
      nodes,
      Boolean(props.loadingOlder),
      props.hasOlder,
      props.loading,
      props.emptyText ?? 'No events found.',
    ),
  );
  let previousRows: EventAnchorRow[] = [];
  let restoredAnchorKey = $state('');

  onDestroy(() => {
    destroyed = true;
    if (props.tabId) setTabFeedAnchor(props.tabId, undefined);
  });

  function handleScrollOffset(offset: number): void {
    if (props.pagingEnabled === false) return;
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    if (
      isRowNearStart(
        rows,
        offset,
        (index) => list?.getItemOffset?.(index),
        isNearStart,
      ) &&
      !props.loadingNewer &&
      props.hasNewer
    )
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
    if (props.pagingEnabled === false) return;
    if (nodes.length > 0 && props.hasOlder && !props.loadingOlder)
      void maybeAutoFill();
  });

  $effect(() => {
    if (
      props.pagingEnabled === false ||
      nodes.length === 0 ||
      !props.hasNewer ||
      props.loadingNewer ||
      newerLoadPending
    )
      return;
    newerLoadPending = true;
    void tick().then(() => {
      if (!destroyed) handleScrollOffset(scrollElement?.scrollTop ?? 0);
      if (!destroyed) newerLoadPending = false;
    });
  });

  $effect(() => {
    previousRows = syncFeedListAnchor({
      tabId: props.tabId,
      previous: previousRows,
      rows: eventRows(rows),
      list,
      key: eventNodeKey,
      destroyed: () => destroyed,
    });
    pinVisibleEvents(nodes.map((node) => node.event.id));
  });

  $effect(() => {
    void restoreFeedListAnchor({
      restore: props.restoreAnchor,
      rows: eventRows(rows),
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
</script>

<FeedActionStatesBridge
  bind:states={actionStates}
  items={props.items}
  activeAccountPubkey={props.activeAccountPubkey}
/>

<div class="event-list">
  {#if rows.length > 0}
    <FeedScrollSurface
      data={rows}
      getKey={(item: unknown) => viewRowKey(item as EventTreeListViewRow)}
      scrollerClass="event-list__scroller"
      viewportClass="event-list__viewport"
      {nearEndEnabled}
      onNearEnd={props.onNearEnd}
      onScrollOffset={handleScrollOffset}
      bind:list
      bind:scrollElement
    >
      {#snippet row(node: unknown)}
        <EventTreeListRows
          node={node as EventTreeListViewRow}
          phase={footerPhase}
          profiles={props.profiles}
          relaySets={props.relaySets}
          activeAccountPubkey={props.activeAccountPubkey}
          reactions={props.reactions}
          reposts={props.reposts}
          {actionStates}
          openProfile={props.openProfile}
          openThread={props.openThread}
          openAuthorContext={props.openAuthorContext}
          leadingRow={props.leadingRow}
        />
      {/snippet}
    </FeedScrollSurface>
  {/if}
</div>
