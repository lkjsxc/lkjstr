<script lang="ts">
  import FeedSurfaceStatus from '$lib/components/events/FeedSurfaceStatus.svelte';
  import NotificationRow from '$lib/components/notifications/NotificationRow.svelte';
  import FeedScrollSurface from '$lib/components/feed/FeedScrollSurface.svelte';
  import {
    feedSurfaceStatusProps,
    footerPhaseFromPaging,
  } from '$lib/feed-surface/footer-phase';
  import {
    notificationViewRowKey,
    notificationViewRows,
    type NotificationViewRow,
  } from '$lib/feed-surface/notification-view-rows';
  import {
    canRequestOlder,
    type OlderLoadTrigger,
  } from '$lib/feed-surface/older-load-mode';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { FeedEvent } from '$lib/events/types';
  import type { NotificationRecord } from '$lib/notifications/notification';

  type Props = {
    listElement?: HTMLElement | undefined;
    records: readonly NotificationRecord[];
    itemById: Map<string, FeedEvent>;
    targetItemById: Map<string, FeedEvent>;
    profiles: Record<string, ProfileSummary>;
    relaySets: readonly RelaySet[];
    activeAccountPubkey?: string | null;
    loadingOlder: boolean;
    hasOlder: boolean;
    error: string | null;
    intentKey?: string;
    onNearEnd: () => void | Promise<void>;
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let {
    listElement = $bindable(),
    records,
    itemById,
    targetItemById,
    profiles,
    relaySets,
    activeAccountPubkey,
    loadingOlder,
    hasOlder,
    error,
    intentKey,
    onNearEnd,
    openProfile,
    openThread,
    openAuthorContext,
  }: Props = $props();

  let scrollElement = $state<HTMLElement | undefined>();
  let rows = $derived(notificationViewRows(records));
  let footerPhase = $derived(
    footerPhaseFromPaging({
      loadingOlder,
      hasOlder,
      rowCount: records.length,
      error,
    }),
  );
  let nearEndEnabled = $derived(
    records.length > 0 && hasOlder && !loadingOlder,
  );

  $effect(() => {
    listElement = scrollElement;
  });

  function requestOlder(trigger: OlderLoadTrigger): void {
    if (
      !nearEndEnabled ||
      !canRequestOlder({
        mode: 'after-user-scroll',
        trigger,
        userScrolledDown: trigger === 'scroll',
      })
    )
      return;
    void onNearEnd();
  }
</script>

<div class="event-list notification-list">
  {#if records.length > 0}
    <FeedScrollSurface
      data={rows}
      getKey={(item: unknown) =>
        notificationViewRowKey(item as NotificationViewRow)}
      scrollerClass="event-list__scroller notification-list-scroller"
      viewportClass="notification-list-scroll"
      {nearEndEnabled}
      {intentKey}
      onNearEnd={requestOlder}
      bind:scrollElement
    >
      {#snippet row(item: unknown)}
        {@const view = item as NotificationViewRow}
        {#if view.kind === 'footer'}
          <FeedSurfaceStatus
            {...feedSurfaceStatusProps(footerPhase, error ?? undefined)}
          />
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
  {/if}
</div>
