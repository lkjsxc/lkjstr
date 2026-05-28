<script lang="ts">
  import { onDestroy } from 'svelte';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import { createOlderRequestCoordinator } from '$lib/feed-surface/speculative-older';
  import { shutdownTimelineTabView } from './timeline-tab-lifecycle';
  import { createBoundTimelineTabRuntime } from './timeline-tab-runtime-create';
  import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
  import { feedSnapshotSeedFromPayload } from '$lib/workspace/tab-snapshot-persist';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { GlobalTimelineRuntime } from '$lib/timeline/global-timeline-runtime';
  import type { TimelineRuntime } from '$lib/timeline/timeline-runtime';
  import {
    homeTimelineEmptyText,
    type TimelineState,
  } from '$lib/timeline/timeline-state';
  import TimelineTabFollowMissing from './TimelineTabFollowMissing.svelte';
  import {
    relayRuntimeKey,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

  type Props = {
    tabId: string;
    visible?: boolean;
    kind?: 'home' | 'global';
    restoreAnchor?: TabFeedAnchor;
    restoreSnapshot?: TabSnapshotPayload;
    activeAccountPubkey?: string | null;
    dataReady?: boolean;
    relaySets: readonly RelaySet[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
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
    relayReadStatus: 'idle',
    relayReadStatusText: '',
  });
  let runtime: TimelineRuntime | GlobalTimelineRuntime | undefined;
  let unsubscribe: (() => void) | undefined;
  let relays: string[] = [];
  let runtimeKey = '';
  let runtimeStartedAt = 0;
  let olderRequests = createOlderRequestCoordinator(
    async () => {
      await runtime?.loadOlder();
    },
    () => Boolean(state.hasOlder && !state.loadingOlder),
  );

  const shutdown = (code: string): void =>
    shutdownTimelineTabView({
      tabId: props.tabId,
      kind: props.kind,
      code,
      runtimeStartedAt,
      state,
      relays,
      runtime,
      unsubscribe,
      clearRuntime: () => {
        unsubscribe = undefined;
        runtime = undefined;
      },
    });

  $effect(() => {
    if (!props.dataReady) return;
    if (!props.visible) {
      runtime?.setVisibility?.(false);
      return;
    }
    runtime?.setVisibility?.(true);
    const nextRelays = timelineRelays(props.relaySets);
    const keyParts = [
      props.kind ?? 'home',
      props.activeAccountPubkey ?? '',
      relayRuntimeKey(nextRelays),
    ];
    if (props.kind === 'global') keyParts.push(props.tabId);
    const nextKey = keyParts.join('|');
    if (nextKey === runtimeKey) return;
    shutdown('timeline-runtime-recreate');
    olderRequests.reset();
    runtimeKey = nextKey;
    relays = nextRelays;
    runtimeStartedAt = Date.now();
    const created = createBoundTimelineTabRuntime({
      tabId: props.tabId,
      kind: props.kind,
      relays,
      activeAccountPubkey: props.activeAccountPubkey,
      seed: feedSnapshotSeedFromPayload(props.restoreSnapshot),
      onState: (next) => {
        state = next;
      },
    });
    runtime = created.runtime;
    unsubscribe = created.unsubscribe;
  });

  $effect(() => {
    const tabId = props.tabId;
    return registerTabRuntimeSnapshot(tabId, () => runtime?.snapshot() ?? {});
  });

  onDestroy(() => shutdown('timeline-runtime-destroy'));
</script>

<section
  class="timeline-tab feed-tab"
  aria-label={props.kind === 'global' ? 'Global' : 'Home'}
>
  {#if !props.dataReady}
    <p>Loading workspace data...</p>
  {:else if state.loading}
    <p>Loading events...</p>
  {/if}
  {#if state.status === 'no-follow-list' && props.kind !== 'global'}
    <TimelineTabFollowMissing
      retry={() => {
        if (
          runtime &&
          'retryFollowDiscovery' in runtime &&
          runtime.retryFollowDiscovery
        )
          runtime.retryFollowDiscovery();
      }}
    />
  {:else if state.error}
    <p role="alert">{state.error}</p>
  {/if}
  <EventTreeList
    tabId={props.tabId}
    pagingEnabled={props.visible !== false}
    restoreAnchor={props.restoreAnchor}
    items={state.items}
    profiles={state.profiles}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    loading={state.loading}
    relayStatusText={state.relayReadStatusText}
    emptyText={homeTimelineEmptyText(state.status)}
    loadingOlder={state.loadingOlder}
    loadingNewer={state.loadingNewer}
    hasOlder={state.hasOlder}
    hasNewer={state.hasNewer}
    olderLoadMode="auto-near-end"
    olderPrefetchReady={Boolean(state.oldestCursor || state.newestCursor)}
    onNearEnd={() => olderRequests.requestFromNearEnd()}
    onNearStart={() => runtime?.loadNewer()}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
</section>
