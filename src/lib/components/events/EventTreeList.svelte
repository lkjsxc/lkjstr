<!-- prettier-ignore -->
<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { isNearStart } from '$lib/feed-surface/near-end';
  import { footerPhaseFromPaging } from '$lib/feed-surface/footer-phase';
  import type { OlderLoadTrigger } from '$lib/feed-surface/older-load-mode';
  import type { FeedScrollListHandle } from '$lib/components/feed/FeedScrollSurface.svelte';
  import type { FlatEventTreeItem } from '$lib/events/tree';
  import EventTreeListSurface from './EventTreeListSurface.svelte';
  import { buildViewRows, eventRows, type EventTreeListViewRow } from './event-tree-list-helpers';
  import { isRowNearStart } from './event-tree-list-near-start-plan';
  import { eventNodeKey, treeNodesFromItems } from './event-tree-list-tree';
  import { canAttemptEventTreeListAutoFill, canRequestEventTreeListOlder, eventTreeListAutoFillIntentState, eventTreeListNearEndEnabled, shouldPrefetchEventTreeListOlder, shouldRequestEventTreeListNewer, shouldScheduleEventTreeListNewerCheck } from './event-tree-list-paging-plan';
  import { clearVisibleEventPins, pinVisibleEvents } from '$lib/cache/pins';
  import type { EventActionState } from '$lib/events/action-state';
  import FeedActionStatesBridge from './FeedActionStatesBridge.svelte';
  import { setTabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import { captureAndStoreFeedListAnchor, restoreFeedListAnchor, syncFeedListAnchor, type EventAnchorRow, type TreeListAnchorHandle } from './event-tree-list-anchors';
  import type { EventTreeListProps as Props } from './event-tree-list-props';
  import { fallbackNodeIds, nearVisibleEventIds } from './event-tree-list-pins';
  let props: Props = $props();
  let list = $state<FeedScrollListHandle & TreeListAnchorHandle>();
  let scrollElement = $state<HTMLElement>();
  let autoFillPending = false;
  let autoFillIntentKey: string | undefined;
  let newerLoadPending = false;
  let scrollOffset = $state(0);
  let destroyed = false;
  const fallbackPinOwner = `event-list:${crypto.randomUUID()}`;
  let pinOwner = $derived(props.tabId ?? fallbackPinOwner);
  const treeCache = { key: '', nodes: [] as FlatEventTreeItem[] };
  let nodes = $derived(treeNodesFromItems(props.items, treeCache));
  let footerPhase = $derived(footerPhaseFromPaging({ loadingOlder: Boolean(props.loadingOlder), hasOlder: props.hasOlder !== false, historyExhaustion: props.historyExhaustion, rowCount: nodes.length, error: props.pagingError }));
  let nearEndEnabled = $derived(eventTreeListNearEndEnabled({ pagingEnabled: props.pagingEnabled, rowCount: nodes.length, hasOlder: props.hasOlder, loadingOlder: props.loadingOlder, hasOnNearEnd: Boolean(props.onNearEnd) }));
  let actionStates = $state(new Map<string, EventActionState>());
  let rows = $derived<EventTreeListViewRow[]>(buildViewRows(props.leadingRows ?? [], nodes, Boolean(props.loadingOlder), props.hasOlder, props.historyExhaustion, props.loading, props.emptyText ?? 'No events found.'));
  let previousRows: EventAnchorRow[] = [];
  let restoredAnchorKey = $state('');
  let autoFillAttempts = 0;
  onDestroy(() => {
    destroyed = true;
    if (props.tabId) setTabFeedAnchor(props.tabId, undefined);
    clearVisibleEventPins(pinOwner);
  });

  function handleScrollOffset(offset: number): void {
    if (props.pagingEnabled === false) return;
    scrollOffset = offset;
    captureAndStoreFeedListAnchor({ tabId: props.tabId, rows: eventRows(rows), list, key: eventNodeKey });
    if (shouldRequestEventTreeListNewer({ pagingEnabled: props.pagingEnabled, nearStart: isRowNearStart(rows, offset, (index) => list?.getItemOffset?.(index), isNearStart), hasNewer: props.hasNewer, loadingNewer: props.loadingNewer }))
      void props.onNearStart?.();
  }
  $effect(() => {
    if (props.pagingEnabled === false) return;
    if (nodes.length > 0 && props.hasOlder && !props.loadingOlder)
      void maybeAutoFill();
  });
  $effect(() => {
    if (!shouldScheduleEventTreeListNewerCheck({ pagingEnabled: props.pagingEnabled, rowCount: nodes.length, hasNewer: props.hasNewer, loadingNewer: props.loadingNewer, newerLoadPending }))
      return;
    newerLoadPending = true;
    void tick().then(() => {
      if (!destroyed) handleScrollOffset(scrollElement?.scrollTop ?? 0);
      if (!destroyed) newerLoadPending = false;
    });
  });
  $effect(() => {
    const anchorRows = eventRows(rows);
    const synced = syncFeedListAnchor({ tabId: props.tabId, previous: previousRows, rows: anchorRows, list, key: eventNodeKey, destroyed: () => destroyed });
    previousRows = synced.rows;
    pinVisibleEvents(
      pinOwner,
      list ? nearVisibleEventIds(rows, list, scrollOffset) : fallbackNodeIds(nodes),
    );
  });
  $effect(() => {
    const next = eventTreeListAutoFillIntentState({ currentIntentKey: autoFillIntentKey, nextIntentKey: props.intentKey, attempts: autoFillAttempts });
    if (!next.changed) return;
    autoFillIntentKey = next.intentKey;
    autoFillAttempts = next.attempts;
  });
  $effect(() => {
    void restoreFeedListAnchor({ restore: props.restoreAnchor, rows: eventRows(rows), list, key: eventNodeKey, destroyed: () => destroyed, restoredKey: restoredAnchorKey }).then((key) => {
      if (!destroyed) restoredAnchorKey = key;
    });
  });
  async function maybeAutoFill(): Promise<void> {
    if (!canAttemptEventTreeListAutoFill({ autoFillPending, loadingOlder: props.loadingOlder, hasOlder: props.hasOlder, attempts: autoFillAttempts }))
      return;
    autoFillPending = true;
    await tick();
    if (destroyed) return;
    const viewport = list?.getViewportSize?.() ?? 0;
    const total = list?.getScrollSize?.() ?? 0;
    const scrollable = total > viewport;
    if (
      shouldPrefetchEventTreeListOlder({ mode: props.olderLoadMode, rowCount: nodes.length, hasOlder: props.hasOlder, loadingOlder: props.loadingOlder, cursorsReady: props.olderPrefetchReady, scrollOffset, viewportSize: viewport, scrollSize: total })
    ) {
      autoFillAttempts += 1;
      await requestOlder('viewport-fill');
    } else if (scrollable) autoFillAttempts = 0;
    if (!destroyed) autoFillPending = false;
  }
  async function requestOlder(trigger: OlderLoadTrigger): Promise<void> {
    if (!canRequestEventTreeListOlder({ loadingOlder: props.loadingOlder, hasOlder: props.hasOlder, rowCount: nodes.length, mode: props.olderLoadMode, trigger, scrollable: (list?.getScrollSize?.() ?? 0) > (list?.getViewportSize?.() ?? 0) }))
      return;
    await props.onNearEnd?.(trigger);
  }
</script>

<FeedActionStatesBridge
  bind:states={actionStates}
  items={props.items}
  activeAccountPubkey={props.activeAccountPubkey}
/>
<div class="event-list">
  {#if props.relayStatusText}<p class="event-list__status">
      {props.relayStatusText}
    </p>{/if}
  {#if rows.length > 0}
    <EventTreeListSurface
      {props}
      {rows}
      phase={footerPhase}
      {nearEndEnabled}
      {actionStates}
      {requestOlder}
      {handleScrollOffset}
      bind:list
      bind:scrollElement
    />
  {/if}
</div>
