<script lang="ts">
  import { untrack } from 'svelte';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import { createOlderRequestCoordinator } from '$lib/feed-surface/speculative-older';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    createThreadRuntime,
    type ThreadRuntime,
  } from '$lib/thread/thread-runtime';
  import type { ThreadState } from '$lib/thread/thread-state';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import { loadTimelineProfiles } from '$lib/timeline/timeline-profiles';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';
  import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
  import { feedRuntimeSnapshot } from '$lib/workspace/feed-runtime-snapshot';

  type ProfileMap = Record<string, ProfileSummary>;
  type ThreadViewState = ThreadState & { profiles: ProfileMap };

  type Props = {
    tabId: string;
    restoreAnchor?: TabFeedAnchor;
    eventId?: string;
    activeAccountPubkey?: string | null;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
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
    loadingNewer: false,
    hasNewer: false,
    newestCursor: undefined,
    oldestCreatedAt: undefined,
    oldestCursor: undefined,
    newerPruned: false,
    reactions: {},
    reposts: {},
    profiles: {},
  });
  let runtime: ThreadRuntime | undefined;
  let runtimeKey = $derived(
    `${props.eventId ?? ''}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );
  let profileRequest = 0;
  let relays: string[] = [];
  let olderRequests = createOlderRequestCoordinator(
    async () => {
      await runtime?.loadOlder();
    },
    () => Boolean(state.hasOlder && !state.loadingOlder),
  );

  $effect(() => {
    const key = runtimeKey;
    if (key === undefined) return;
    const { eventId, relaySets, tabId } = untrack(() => props);
    if (!eventId) return;
    olderRequests.reset();
    relays = timelineRelays(relaySets);
    runtime = createThreadRuntime(
      eventId,
      relays,
      createTimelineSubId(tabId, 'thread'),
    );
    const unsubscribe = runtime.subscribe(
      (next) => (state = { ...next, profiles: currentProfiles }),
    );
    runtime.start();
    return () => {
      profileRequest += 1;
      unsubscribe();
      runtime?.close();
      runtime = undefined;
    };
  });

  $effect(() => {
    const tabId = props.tabId;
    return registerTabRuntimeSnapshot(tabId, () => feedRuntimeSnapshot(state));
  });

  $effect(() => {
    const authors = [
      ...new Set([
        ...state.items.map((item) => item.event.pubkey),
        ...Object.values(state.reactions).flatMap((groups) =>
          groups.flatMap((group) => group.actors),
        ),
        ...Object.values(state.reposts).flatMap((group) => group.actors),
      ]),
    ];
    const missing = authors.filter((author) => !state.profiles[author]);
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
</script>

<section class="data-tab" aria-label="Thread">
  {#if props.eventId}
    {#if state.loading}<p>Loading thread...</p>{/if}
    {#if state.error}<p role="alert">{state.error}</p>{/if}
    <EventTreeList
      tabId={props.tabId}
      restoreAnchor={props.restoreAnchor}
      items={state.items}
      profiles={state.profiles}
      relaySets={props.relaySets}
      activeAccountPubkey={props.activeAccountPubkey}
      reactions={state.reactions}
      reposts={state.reposts}
      loading={state.loading}
      loadingOlder={state.loadingOlder}
      loadingNewer={state.loadingNewer}
      hasOlder={state.hasOlder}
      hasNewer={state.hasNewer}
      onNearEnd={() => olderRequests.requestFromNearEnd()}
      onNearStart={() => runtime?.loadNewer()}
      openProfile={props.openProfile}
      openThread={props.openThread}
      openAuthorContext={props.openAuthorContext}
      emptyText="No thread events found."
    />
  {:else}
    <p>Open threads from a timeline event.</p>
  {/if}
</section>
