<script lang="ts">
  import FeedSurfaceStatus from '$lib/components/events/FeedSurfaceStatus.svelte';
  import NotificationRow from '$lib/components/notifications/NotificationRow.svelte';
  import { isNearEnd, nearEndRootMargin } from '$lib/feed-surface/near-end';
  import { createNearEndSentinel } from '$lib/feed-surface/near-end-observer';
  import {
    feedSurfaceStatusProps,
    footerPhaseFromPaging,
  } from '$lib/feed-surface/footer-phase';
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
    onNearEnd,
    openProfile,
    openThread,
    openAuthorContext,
  }: Props = $props();
  let sentinelElement: HTMLDivElement | undefined;
  let footerPhase = $derived(
    footerPhaseFromPaging({
      loadingOlder,
      hasOlder,
      rowCount: records.length,
      error,
    }),
  );
  const nearEndSentinel = createNearEndSentinel({
    root: () => listElement,
    sentinel: () => sentinelElement,
    rootMargin: () => nearEndRootMargin(listElement?.clientHeight ?? 0),
    enabled: () => records.length > 0 && hasOlder && !loadingOlder,
    onNearEnd: () => onNearEnd(),
  });

  $effect(() => {
    const count = records.length;
    const older = hasOlder;
    const loading = loadingOlder;
    if (count === 0 && !older && !loading)
      return () => nearEndSentinel.disconnect();
    nearEndSentinel.observe();
    return () => nearEndSentinel.disconnect();
  });

  function handleScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    if (isNearEnd(el.scrollTop, el.clientHeight, el.scrollHeight))
      void onNearEnd();
  }
</script>

<div
  class="notification-list"
  data-scroll-owner=""
  bind:this={listElement}
  onscroll={handleScroll}
>
  {#each records as record (record.id)}
    <NotificationRow
      {record}
      item={itemById.get(record.sourceEventId)}
      targetItem={targetItemById.get(
        record.targetEventId ?? record.rootEventId ?? '',
      )}
      profile={profiles[record.actorPubkey]}
      {profiles}
      {relaySets}
      activeAccountPubkey={activeAccountPubkey ?? null}
      {openProfile}
      {openThread}
      {openAuthorContext}
    />
  {/each}
  <div
    class="event-list__near-end-sentinel"
    bind:this={sentinelElement}
    aria-hidden="true"
  ></div>
  <FeedSurfaceStatus
    {...feedSurfaceStatusProps(footerPhase, error ?? undefined)}
  />
</div>
