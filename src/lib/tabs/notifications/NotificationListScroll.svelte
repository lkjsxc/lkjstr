<!-- prettier-ignore -->
<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import FeedSurfaceStatus from '$lib/components/events/FeedSurfaceStatus.svelte';
  import NotificationRow from '$lib/components/notifications/NotificationRow.svelte';
  import FeedScrollSurface from '$lib/components/feed/FeedScrollSurface.svelte';
  import type { FeedScrollListHandle } from '$lib/components/feed/FeedScrollSurface.svelte';
  import { clearOpenReferencePins, pinOpenReferences } from '$lib/cache/pins';
  import { captureVirtualAnchor, restoreVirtualAnchor } from '$lib/events/scroll-anchor';
  import { feedSurfaceStatusProps, footerPhaseFromPaging } from '$lib/feed-surface/footer-phase';
  import { notificationOpenReferenceIds, notificationViewRowKey, notificationViewRows, type NotificationViewRow } from '$lib/feed-surface/notification-view-rows';
  import { canRequestOlder, type OlderLoadTrigger } from '$lib/feed-surface/older-load-mode';
  import type { HistoryExhaustion } from '$lib/feed-surface/paging-state';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { FeedEvent } from '$lib/events/types';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import { setTabFeedAnchor, type TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import { notificationAutoFillAttemptCap, notificationAutoFillAttemptCount, setNotificationAutoFillAttemptCount, shouldAttemptNotificationAutoFill, shouldShowNotificationRetry } from './notification-list-state';
  type Props = {
    tabId: string;
    restoreAnchor?: TabFeedAnchor;
    listElement?: HTMLElement | undefined;
    records: readonly NotificationRecord[];
    itemById: Map<string, FeedEvent>;
    targetItemById: Map<string, FeedEvent>;
    profiles: Record<string, ProfileSummary>;
    relaySets: readonly RelaySet[];
    activeAccountPubkey?: string | null;
    loadingOlder: boolean;
    hasOlder: boolean;
    olderPrefetchReady: boolean;
    historyExhaustion?: HistoryExhaustion;
    error: string | null;
    intentKey?: string;
    onNearEnd: () => void | Promise<void>;
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };
  let {
    tabId,
    restoreAnchor,
    listElement = $bindable(),
    records,
    itemById,
    targetItemById,
    profiles,
    relaySets,
    activeAccountPubkey,
    loadingOlder,
    hasOlder,
    olderPrefetchReady,
    historyExhaustion,
    error,
    intentKey,
    onNearEnd,
    openProfile,
    openThread,
    openAuthorContext,
  }: Props = $props();
  let scrollElement = $state<HTMLElement | undefined>();
  let list = $state<FeedScrollListHandle>();
  let restoredAnchorKey = $state('');
  let autoFillPending = false;
  let autoFillAttempts = 0;
  let autoFillExhausted = $state(false);
  const fallbackPinOwner = `notifications:${crypto.randomUUID()}`;
  let pinOwner = $derived(tabId ? `notifications:${tabId}` : fallbackPinOwner);
  let rows = $derived(notificationViewRows(records));
  let footerPhase = $derived(footerPhaseFromPaging({ loadingOlder, hasOlder, historyExhaustion, rowCount: records.length, error }));
  let nearEndEnabled = $derived(hasOlder && !loadingOlder && olderPrefetchReady);
  let retryVisible = $derived(autoFillExhausted && shouldShowNotificationRetry({ recordCount: records.length, hasOlder, loadingOlder, olderPrefetchReady, historyExhaustion, error, autoFillAttempts: notificationAutoFillAttemptCap }));
  $effect(() => {
    listElement = scrollElement;
  });
  onDestroy(() => {
    if (tabId) setTabFeedAnchor(tabId, undefined);
  });
  $effect(() => {
    pinOpenReferences(pinOwner, notificationOpenReferenceIds(records));
    return () => clearOpenReferencePins(pinOwner);
  });
  $effect(() => {
    const saved = notificationAutoFillAttemptCount(tabId);
    if (saved === autoFillAttempts) return;
    autoFillAttempts = saved;
    autoFillExhausted = saved >= notificationAutoFillAttemptCap;
  });
  $effect(() => {
    const restore = restoreAnchor;
    if (!restore || !list?.scrollTo) return;
    const key = `${restore.anchorKey}:${restore.offset}`;
    if (restoredAnchorKey === key) return;
    void tick().then(() => {
      restoreVirtualAnchor({ key: restore.anchorKey, offset: restore.offset }, rows, notificationViewRowKey, list);
      restoredAnchorKey = key;
    });
  });

  $effect(() => {
    if (!autoFillExhausted && shouldAttemptNotificationAutoFill({ hasOlder, loadingOlder, olderPrefetchReady, autoFillPending, autoFillAttempts })) void maybeAutoFill();
  });

  function requestOlder(trigger: OlderLoadTrigger): void {
    const scrollable = (list?.getScrollSize?.() ?? 0) > (list?.getViewportSize?.() ?? 0);
    if (trigger !== 'scroll' || !nearEndEnabled || !canRequestOlder({ mode: 'fill-then-user-scroll', trigger, userScrolledDown: true, scrollable })) return;
    void onNearEnd();
  }

  function captureCurrentAnchor(): void {
    const anchor = captureVirtualAnchor(rows.filter((row) => row.kind === 'record'), notificationViewRowKey, list);
    if (!anchor) return;
    setTabFeedAnchor(tabId, { anchorKey: anchor.key, offset: anchor.offset });
  }

  function requestExplicitOlder(): void {
    if (!hasOlder || loadingOlder || !olderPrefetchReady) return;
    void onNearEnd();
  }

  async function maybeAutoFill(): Promise<void> {
    if (autoFillExhausted || !shouldAttemptNotificationAutoFill({ hasOlder, loadingOlder, olderPrefetchReady, autoFillPending, autoFillAttempts })) return;
    autoFillPending = true;
    await tick();
    const scrollable = (list?.getScrollSize?.() ?? 0) > (list?.getViewportSize?.() ?? 0);
    if (
      !scrollable &&
      canRequestOlder({ mode: 'fill-then-user-scroll', trigger: 'viewport-fill', userScrolledDown: false, scrollable })
    ) {
      autoFillAttempts += 1;
      setNotificationAutoFillAttemptCount(tabId, autoFillAttempts);
      if (autoFillAttempts >= notificationAutoFillAttemptCap)
        autoFillExhausted = true;
      void Promise.resolve(onNearEnd()).finally(() => { autoFillPending = false; if (!autoFillExhausted) void tick().then(() => void maybeAutoFill()); });
      return;
    } else if (scrollable) {
      autoFillAttempts = 0;
      setNotificationAutoFillAttemptCount(tabId, autoFillAttempts);
      autoFillExhausted = false;
    }
    autoFillPending = false;
  }

</script>

<div class="event-list notification-list">
  <FeedScrollSurface
    data={rows}
    getKey={(item: unknown) =>
      notificationViewRowKey(item as NotificationViewRow)}
    scrollerClass="event-list__scroller notification-list-scroller"
    viewportClass="notification-list-scroll"
    {nearEndEnabled}
    {intentKey}
    onNearEnd={requestOlder}
    onScrollOffset={captureCurrentAnchor}
    bind:list
    bind:scrollElement
  >
    {#snippet row(item: unknown)}
      {@const view = item as NotificationViewRow}
      {#if view.kind === 'footer'}
        {#if retryVisible}
          <button
            class="notification-list__retry"
            type="button"
            onclick={requestExplicitOlder}
          >
            Load older notifications
          </button>
        {:else}
          <FeedSurfaceStatus
            {...feedSurfaceStatusProps(footerPhase, error ?? undefined)}
          />
        {/if}
      {:else}
        <NotificationRow
          record={view.record}
          item={itemById.get(view.record.sourceEventId)}
          targetItem={targetItemById.get(
            view.record.targetEventId ?? view.record.rootEventId ?? '',
          )}
          profile={profiles[view.record.actorPubkey]}
          {profiles}
          {relaySets}
          activeAccountPubkey={activeAccountPubkey ?? null}
          {openProfile}
          {openThread}
          {openAuthorContext}
        />
      {/if}
    {/snippet}
  </FeedScrollSurface>
</div>
