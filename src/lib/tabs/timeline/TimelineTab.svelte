<script lang="ts">
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { GlobalTimelineRuntime } from '$lib/timeline/global-timeline-runtime';
  import { TimelineRuntime } from '$lib/timeline/timeline-runtime';
  import type { TimelineState } from '$lib/timeline/timeline-state';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';

  type Props = {
    tabId: string;
    kind?: 'home' | 'global';
    activeAccountPubkey?: string | null;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
  };

  let props: Props = $props();
  let state = $state<TimelineState>({
    items: [],
    loading: true,
    error: null,
    status: 'loading-follows',
    connectedRelays: 0,
    eoseRelays: 0,
    authors: [],
    profiles: {},
    diagnostics: [],
    loadingOlder: false,
    loadingNewer: false,
    hasOlder: true,
    hasNewer: false,
    oldestCursor: undefined,
    newestCursor: undefined,
  });
  let runtime: TimelineRuntime | GlobalTimelineRuntime | undefined;

  $effect(() => {
    const relays = timelineRelays(props.relaySets);
    const Runtime =
      props.kind === 'global' ? GlobalTimelineRuntime : TimelineRuntime;
    runtime = new Runtime({
      relays,
      subId: createTimelineSubId(props.tabId),
      activeAccountPubkey: props.activeAccountPubkey,
    });
    const unsubscribe = runtime.subscribe((next) => (state = next));
    runtime.start();
    return () => {
      unsubscribe();
      runtime?.close();
    };
  });

  $effect(() => {
    const authors = [...new Set(state.items.map((item) => item.event.pubkey))];
    const missing = authors.filter((author) => !state.profiles[author]);
    if (missing.length === 0) return;
    void loadTimelineProfiles(missing).then((loaded) => {
      state = { ...state, profiles: { ...loaded, ...state.profiles } };
    });
  });
</script>

<section
  class="timeline-tab"
  aria-label={props.kind === 'global' ? 'Global' : 'Home'}
>
  {#if state.loading}
    <p>Loading events...</p>
  {/if}
  {#if state.error}
    <p role="alert">{state.error}</p>
  {/if}
  <EventTreeList
    items={state.items}
    profiles={state.profiles}
    loading={state.loading}
    emptyText="No events yet."
    loadingOlder={state.loadingOlder}
    loadingNewer={state.loadingNewer}
    hasOlder={state.hasOlder}
    hasNewer={state.hasNewer}
    onNearEnd={() => runtime?.loadOlder()}
    onNearStart={() => runtime?.loadNewer()}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
</section>
