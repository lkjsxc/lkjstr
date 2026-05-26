<script lang="ts">
  import { tick, untrack } from 'svelte';
  import FeedSurfaceStatus from '$lib/components/events/FeedSurfaceStatus.svelte';
  import NotificationRow from '$lib/components/notifications/NotificationRow.svelte';
  import { isNearEnd } from '$lib/feed-surface/near-end';
  import { metadataPageLimit } from '$lib/events/feed-window';
  import { createOlderRequestCoordinator } from '$lib/feed-surface/speculative-older';
  import type { ProfileSummary } from '$lib/identity/identity';
  import {
    createNotificationRuntime,
    type NotificationRuntime,
  } from '$lib/notifications/notification-runtime';
  import type { NotificationState } from '$lib/notifications/notification-runtime';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { FeedEvent } from '$lib/events/types';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type ProfileMap = Record<string, ProfileSummary>;
  type NotificationViewState = NotificationState & { profiles: ProfileMap };

  type Props = {
    tabId: string;
    accountPubkey?: string;
    visible: boolean;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let runtime: NotificationRuntime | undefined;
  let currentProfiles: ProfileMap = {};
  let profileRequest = 0;
  let state = $state<NotificationViewState>({
    records: [],
    items: [],
    targetItems: [],
    loading: true,
    error: null,
    loadingOlder: false,
    hasOlder: true,
    oldestCreatedAt: undefined,
    newerPruned: false,
    profiles: {},
  });
  let itemById: Map<string, FeedEvent> = $derived(
    new Map(state.items.map((item) => [item.event.id, item])),
  );
  let targetItemById: Map<string, FeedEvent> = $derived(
    new Map(state.targetItems.map((item) => [item.event.id, item])),
  );
  let relays: string[] = [];
  let listElement: HTMLElement | undefined;
  let autoFillPending = false;
  let destroyed = false;
  let runtimeKey = $derived(
    `${props.accountPubkey ?? ''}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );
  let olderRequests = createOlderRequestCoordinator(
    async () => {
      await runtime?.loadOlder();
    },
    () => Boolean(state.hasOlder && !state.loadingOlder),
  );

  $effect(() => {
    const key = runtimeKey;
    if (key === undefined) return;
    const { accountPubkey, relaySets, tabId } = untrack(() => props);
    olderRequests.reset();
    relays = timelineRelays(relaySets);
    runtime = createNotificationRuntime(
      accountPubkey,
      relays,
      createTimelineSubId(tabId, 'notif'),
    );
    const unsubscribe = runtime.subscribe(
      (next) => (state = { ...next, profiles: currentProfiles }),
    );
    void runtime.start().then(() => markVisibleRead());
    const onFocus = () => void markVisibleRead();
    window.addEventListener('focus', onFocus);
    return () => {
      destroyed = true;
      profileRequest += 1;
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      runtime?.close();
      runtime = undefined;
    };
  });

  $effect(() => {
    if (props.visible) void markVisibleRead();
  });

  $effect(() => {
    const authors = [
      ...new Set([
        ...state.records.map((record) => record.actorPubkey),
        ...state.items.map((item) => item.event.pubkey),
        ...state.targetItems.map((item) => item.event.pubkey),
      ]),
    ];
    const missing = authors
      .filter((author) => !state.profiles[author])
      .slice(0, metadataPageLimit);
    if (missing.length === 0) return;
    const request = ++profileRequest;
    void loadTimelineProfiles(missing, relays, `${props.tabId}:profiles`).then(
      (loaded) => {
        if (request !== profileRequest || !runtime) return;
        currentProfiles = { ...loaded, ...currentProfiles };
        state = { ...state, profiles: currentProfiles };
      },
    );
  });

  $effect(() => {
    if (!state.loading && state.records.length > 0) void maybeAutoFill();
  });

  function handleScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    if (isNearEnd(el.scrollTop, el.clientHeight, el.scrollHeight))
      void olderRequests.requestFromNearEnd();
  }

  async function markVisibleRead(): Promise<void> {
    if (!props.visible || document.visibilityState !== 'visible') return;
    await runtime?.markVisibleRead();
  }

  async function maybeAutoFill(): Promise<void> {
    if (autoFillPending || state.loadingOlder || !state.hasOlder || !runtime)
      return;
    autoFillPending = true;
    await tick();
    if (destroyed) return;
    const el = listElement;
    if (el && el.clientHeight > 0 && el.scrollHeight <= el.clientHeight + 16)
      await runtime.loadOlder();
    if (!destroyed) autoFillPending = false;
  }
</script>

<section class="data-tab" aria-label="Notifications">
  {#if state.loading}<p>Loading notifications...</p>{/if}
  {#if state.error}<p role="alert">{state.error}</p>{/if}
  <div
    class="notification-list"
    bind:this={listElement}
    onscroll={handleScroll}
  >
    {#if state.records.length > 0}
      {#each state.records as record (record.id)}
        <NotificationRow
          {record}
          item={itemById.get(record.sourceEventId)}
          targetItem={targetItemById.get(
            record.targetEventId ?? record.rootEventId ?? '',
          )}
          profile={state.profiles[record.actorPubkey]}
          profiles={state.profiles}
          relaySets={props.relaySets}
          activeAccountPubkey={props.accountPubkey ?? null}
          openProfile={props.openProfile}
          openThread={props.openThread}
          openAuthorContext={props.openAuthorContext}
        />
      {/each}
    {:else if !state.loading}
      <p>No notifications for the active account.</p>
    {/if}
    <FeedSurfaceStatus
      loadingOlder={state.loadingOlder && state.hasOlder}
      endOfHistory={state.hasOlder === false && state.records.length > 0}
    />
  </div>
</section>
