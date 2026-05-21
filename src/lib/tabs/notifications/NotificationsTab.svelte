<script lang="ts">
  import { untrack } from 'svelte';
  import NotificationRow from '$lib/components/notifications/NotificationRow.svelte';
  import { isNearEnd, metadataPageLimit } from '$lib/events/feed-window';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { NotificationRuntime } from '$lib/notifications/notification-runtime';
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
  };

  let props: Props = $props();
  let runtime: NotificationRuntime | undefined;
  let currentProfiles: ProfileMap = {};
  let profileRequest = 0;
  let state = $state<NotificationViewState>({
    records: [],
    items: [],
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
  let relays: string[] = [];
  let runtimeKey = $derived(
    `${props.accountPubkey ?? ''}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );

  $effect(() => {
    const key = runtimeKey;
    if (key === undefined) return;
    const { accountPubkey, relaySets, tabId } = untrack(() => props);
    relays = timelineRelays(relaySets);
    runtime = new NotificationRuntime(
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
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      runtime?.close();
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
      ]),
    ];
    const missing = authors
      .filter((author) => !state.profiles[author])
      .slice(0, metadataPageLimit);
    if (missing.length === 0) return;
    const request = ++profileRequest;
    void loadTimelineProfiles(missing, relays, `${props.tabId}:profiles`).then(
      (loaded) => {
        if (request !== profileRequest) return;
        currentProfiles = { ...loaded, ...currentProfiles };
        state = { ...state, profiles: currentProfiles };
      },
    );
  });

  function handleScroll(event: Event): void {
    const el = event.currentTarget as HTMLElement;
    if (
      isNearEnd(el.scrollTop, el.clientHeight, el.scrollHeight) &&
      !state.loadingOlder &&
      state.hasOlder
    )
      void runtime?.loadOlder();
  }

  async function markVisibleRead(): Promise<void> {
    if (!props.visible || document.visibilityState !== 'visible') return;
    await runtime?.markVisibleRead();
  }
</script>

<section class="data-tab" aria-label="Notifications">
  {#if state.loading}<p>Loading notifications...</p>{/if}
  {#if state.error}<p role="alert">{state.error}</p>{/if}
  <div class="notification-list" onscroll={handleScroll}>
    {#if state.records.length > 0}
      {#each state.records as record (record.id)}
        <NotificationRow
          {record}
          item={itemById.get(record.sourceEventId)}
          profile={state.profiles[record.actorPubkey]}
          profiles={state.profiles}
          openProfile={props.openProfile}
          openThread={props.openThread}
        />
      {/each}
    {:else if !state.loading}
      <p>No notifications for the active account.</p>
    {/if}
    {#if state.loadingOlder}
      <p class="event-list__status">Loading older notifications...</p>
    {:else if state.hasOlder === false && state.records.length > 0}
      <p class="event-list__status">End of loaded notifications.</p>
    {/if}
  </div>
</section>
