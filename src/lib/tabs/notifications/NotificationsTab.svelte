<script lang="ts">
  import { onDestroy, tick, untrack } from 'svelte';
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
  import NotificationListScroll from './NotificationListScroll.svelte';
  import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
  import { feedRuntimeSnapshot } from '$lib/workspace/feed-runtime-snapshot';

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
  let listElement = $state<HTMLElement | undefined>();
  let autoFillPending = false;
  let destroyed = false;
  let viewState = $state<NotificationViewState>({
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
    new Map(viewState.items.map((item) => [item.event.id, item])),
  );
  let targetItemById: Map<string, FeedEvent> = $derived(
    new Map(viewState.targetItems.map((item) => [item.event.id, item])),
  );
  let relays: string[] = [];
  let runtimeKey = $derived(
    `${props.accountPubkey ?? ''}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );
  onDestroy(() => {
    destroyed = true;
    runtime?.close();
    runtime = undefined;
  });

  let olderRequests = createOlderRequestCoordinator(
    async () => {
      await runtime?.loadOlder();
    },
    () => Boolean(viewState.hasOlder && !viewState.loadingOlder),
  );

  $effect(() => {
    if (!props.visible) {
      return () => {
        profileRequest += 1;
        runtime?.close();
        runtime = undefined;
      };
    }
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
      (next) => (viewState = { ...next, profiles: currentProfiles }),
    );
    void runtime.start().then(() => markVisibleRead());
    const onFocus = () => void markVisibleRead();
    window.addEventListener('focus', onFocus);
    return () => {
      profileRequest += 1;
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      runtime?.close();
      runtime = undefined;
    };
  });

  $effect(() => {
    const tabId = props.tabId;
    return registerTabRuntimeSnapshot(tabId, () =>
      feedRuntimeSnapshot(viewState),
    );
  });

  $effect(() => {
    if (props.visible) void markVisibleRead();
  });

  $effect(() => {
    if (!props.visible) return;
    const authors = [
      ...new Set([
        ...viewState.records.map((record) => record.actorPubkey),
        ...viewState.items.map((item) => item.event.pubkey),
        ...viewState.targetItems.map((item) => item.event.pubkey),
      ]),
    ];
    const missing = authors
      .filter((author) => !viewState.profiles[author])
      .slice(0, metadataPageLimit);
    if (missing.length === 0) return;
    const request = ++profileRequest;
    void loadTimelineProfiles(missing, relays, `${props.tabId}:profiles`).then(
      (loaded) => {
        if (request !== profileRequest || !runtime) return;
        currentProfiles = { ...loaded, ...currentProfiles };
        viewState = { ...viewState, profiles: currentProfiles };
      },
    );
  });

  $effect(() => {
    if (!props.visible) return;
    if (!viewState.loading && viewState.records.length > 0)
      void maybeAutoFill();
  });

  async function markVisibleRead(): Promise<void> {
    if (!props.visible || document.visibilityState !== 'visible') return;
    await runtime?.markVisibleRead();
  }

  async function maybeAutoFill(): Promise<void> {
    if (
      autoFillPending ||
      viewState.loadingOlder ||
      !viewState.hasOlder ||
      !runtime
    )
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
  {#if viewState.loading}<p>Loading notifications...</p>{/if}
  {#if viewState.error}<p role="alert">{viewState.error}</p>{/if}
  {#if viewState.records.length > 0}
    <NotificationListScroll
      records={viewState.records}
      {itemById}
      {targetItemById}
      profiles={viewState.profiles}
      relaySets={props.relaySets}
      activeAccountPubkey={props.accountPubkey}
      loadingOlder={viewState.loadingOlder}
      hasOlder={viewState.hasOlder}
      error={viewState.error}
      onNearEnd={() => olderRequests.requestFromNearEnd()}
      openProfile={props.openProfile}
      openThread={props.openThread}
      openAuthorContext={props.openAuthorContext}
      bind:listElement
    />
  {:else if !viewState.loading}
    <p>No notifications for the active account.</p>
  {/if}
</section>
