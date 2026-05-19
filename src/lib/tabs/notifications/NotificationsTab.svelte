<script lang="ts">
  import NotificationRow from '$lib/components/notifications/NotificationRow.svelte';
  import { isNearEnd } from '$lib/events/feed-window';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { NotificationRuntime } from '$lib/notifications/notification-runtime';
  import type { NotificationState } from '$lib/notifications/notification-runtime';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type Props = {
    tabId: string;
    accountPubkey?: string;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
  };

  let props: Props = $props();
  let runtime: NotificationRuntime | undefined;
  let profiles = $state<Record<string, ProfileSummary>>({});
  let state = $state<NotificationState>({
    records: [],
    items: [],
    loading: true,
    error: null,
    loadingOlder: false,
    hasOlder: true,
    oldestCreatedAt: undefined,
    newerPruned: false,
  });
  let itemById = $derived(
    new Map(state.items.map((item) => [item.event.id, item])),
  );

  $effect(() => {
    runtime = new NotificationRuntime(
      props.accountPubkey,
      timelineRelays(props.relaySets),
      createTimelineSubId(props.tabId),
    );
    const unsubscribe = runtime.subscribe((next) => (state = next));
    void runtime.start().then(() => runtime?.markVisibleRead());
    const onFocus = () => runtime?.markVisibleRead();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      unsubscribe();
      runtime?.close();
    };
  });

  $effect(() => {
    const authors = [
      ...new Set([
        ...state.records.map((record) => record.actorPubkey),
        ...state.items.map((item) => item.event.pubkey),
      ]),
    ];
    void loadTimelineProfiles(authors).then((loaded) => {
      profiles = loaded;
    });
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
</script>

<section class="data-tab" aria-label="Notifications">
  <h2>Notifications</h2>
  {#if state.loading}<p>Loading notifications...</p>{/if}
  {#if state.error}<p role="alert">{state.error}</p>{/if}
  {#if state.newerPruned}
    <button type="button" onclick={() => runtime?.resetToLatest()}>
      Latest
    </button>
  {/if}
  <div class="notification-list" onscroll={handleScroll}>
    {#if state.records.length > 0}
      {#each state.records as record (record.id)}
        <NotificationRow
          {record}
          item={itemById.get(record.sourceEventId)}
          profile={profiles[record.actorPubkey]}
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
