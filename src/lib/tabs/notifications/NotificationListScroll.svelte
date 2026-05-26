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
    listElement?: HTMLElement;
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

  let props: Props = $props();
  let listElement = $bindable<HTMLElement | undefined>(props.listElement);
  let sentinelElement: HTMLDivElement | undefined;
  let footerPhase = $derived(
    footerPhaseFromPaging({
      loadingOlder: props.loadingOlder,
      hasOlder: props.hasOlder,
      rowCount: props.records.length,
      error: props.error,
    }),
  );
  const nearEndSentinel = createNearEndSentinel({
    root: () => listElement,
    sentinel: () => sentinelElement,
    rootMargin: () => nearEndRootMargin(listElement?.clientHeight ?? 0),
    enabled: () =>
      props.records.length > 0 && props.hasOlder && !props.loadingOlder,
    onNearEnd: () => props.onNearEnd(),
  });

  $effect(() => {
    props.records.length;
    props.hasOlder;
    props.loadingOlder;
    nearEndSentinel.observe();
    return () => nearEndSentinel.disconnect();
  });

  function handleScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    if (isNearEnd(el.scrollTop, el.clientHeight, el.scrollHeight))
      void props.onNearEnd();
  }
</script>

<div class="notification-list" bind:this={listElement} onscroll={handleScroll}>
  {#each props.records as record (record.id)}
    <NotificationRow
      {record}
      item={props.itemById.get(record.sourceEventId)}
      targetItem={props.targetItemById.get(
        record.targetEventId ?? record.rootEventId ?? '',
      )}
      profile={props.profiles[record.actorPubkey]}
      profiles={props.profiles}
      relaySets={props.relaySets}
      activeAccountPubkey={props.activeAccountPubkey ?? null}
      openProfile={props.openProfile}
      openThread={props.openThread}
      openAuthorContext={props.openAuthorContext}
    />
  {/each}
  <div
    class="event-list__near-end-sentinel"
    bind:this={sentinelElement}
    aria-hidden="true"
  ></div>
  <FeedSurfaceStatus
    {...feedSurfaceStatusProps(footerPhase, props.error ?? undefined)}
  />
</div>
