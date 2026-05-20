<script lang="ts">
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { ThreadRuntime } from '$lib/thread/thread-runtime';
  import type { ThreadState } from '$lib/thread/thread-state';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type ProfileMap = Record<string, ProfileSummary>;
  type ThreadViewState = ThreadState & { profiles: ProfileMap };

  type Props = {
    tabId: string;
    eventId?: string;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
  };

  let props: Props = $props();
  let currentProfiles: ProfileMap = {};
  let state = $state<ThreadViewState>({
    items: [],
    loading: true,
    error: null,
    eoseRelays: 0,
    loadingOlder: false,
    hasOlder: true,
    oldestCreatedAt: undefined,
    oldestCursor: undefined,
    newerPruned: false,
    reactions: {},
    profiles: {},
  });
  let runtime: ThreadRuntime | undefined;
  let profileRequest = 0;
  let relays: string[] = [];

  $effect(() => {
    if (!props.eventId) return;
    relays = timelineRelays(props.relaySets);
    runtime = new ThreadRuntime(
      props.eventId,
      relays,
      createTimelineSubId(props.tabId, 'thread'),
    );
    const unsubscribe = runtime.subscribe(
      (next) => (state = { ...next, profiles: currentProfiles }),
    );
    runtime.start();
    return () => {
      unsubscribe();
      runtime?.close();
    };
  });

  $effect(() => {
    const authors = [
      ...new Set([
        ...state.items.map((item) => item.event.pubkey),
        ...Object.values(state.reactions).flatMap((groups) =>
          groups.flatMap((group) => group.actors),
        ),
      ]),
    ];
    const missing = authors.filter((author) => !state.profiles[author]);
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
</script>

<section class="data-tab">
  <h2>Thread</h2>
  {#if props.eventId}
    {#if state.loading}<p>Loading thread...</p>{/if}
    {#if state.error}<p role="alert">{state.error}</p>{/if}
    <EventTreeList
      items={state.items}
      profiles={state.profiles}
      relaySets={props.relaySets}
      reactions={state.reactions}
      loading={state.loading}
      loadingOlder={state.loadingOlder}
      hasOlder={state.hasOlder}
      onNearEnd={() => runtime?.loadOlder()}
      openProfile={props.openProfile}
      openThread={props.openThread}
      emptyText="No thread events found."
    />
  {:else}
    <p>Open threads from a timeline event.</p>
  {/if}
</section>
