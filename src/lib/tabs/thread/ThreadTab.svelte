<script lang="ts">
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { ThreadRuntime, type ThreadState } from '$lib/thread/thread-runtime';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type Props = {
    tabId: string;
    eventId?: string;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
  };

  let props: Props = $props();
  let profiles = $state<Record<string, ProfileSummary>>({});
  let state = $state<ThreadState>({
    items: [],
    loading: true,
    error: null,
    eoseRelays: 0,
    loadingOlder: false,
    hasOlder: true,
    oldestCreatedAt: undefined,
    newerPruned: false,
  });
  let runtime: ThreadRuntime | undefined;

  $effect(() => {
    if (!props.eventId) return;
    runtime = new ThreadRuntime(
      props.eventId,
      timelineRelays(props.relaySets),
      createTimelineSubId(props.tabId),
    );
    const unsubscribe = runtime.subscribe((next) => (state = next));
    runtime.start();
    return () => {
      unsubscribe();
      runtime?.close();
    };
  });

  $effect(() => {
    const authors = [...new Set(state.items.map((item) => item.event.pubkey))];
    void loadTimelineProfiles(authors).then((loaded) => {
      profiles = loaded;
    });
  });
</script>

<section class="data-tab">
  <h2>Thread</h2>
  {#if props.eventId}
    {#if state.loading}<p>Loading thread...</p>{/if}
    {#if state.error}<p role="alert">{state.error}</p>{/if}
    <EventTreeList
      items={state.items}
      {profiles}
      loading={state.loading}
      loadingOlder={state.loadingOlder}
      hasOlder={state.hasOlder}
      newerPruned={state.newerPruned}
      onNearEnd={() => runtime?.loadOlder()}
      resetToLatest={() => runtime?.resetToLatest()}
      openProfile={props.openProfile}
      openThread={props.openThread}
      emptyText="No thread events found."
    />
  {:else}
    <p>Open threads from a timeline event.</p>
  {/if}
</section>
