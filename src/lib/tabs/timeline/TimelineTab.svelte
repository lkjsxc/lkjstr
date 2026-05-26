<script lang="ts">
  import { onDestroy } from 'svelte';
  import { decMemoryCounter, incMemoryCounter } from '$lib/app/memory-counters';
  import { reportFeedRuntimeWindowSize } from '$lib/app/memory-debug';
  import {
    countRuntime,
    setRuntimeCounterActive,
  } from '$lib/app/runtime-counters';
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import { createOlderRequestCoordinator } from '$lib/feed-surface/speculative-older';
  import { appendAppLog } from '$lib/log/app-log';
  import { consumeTabCloseReason } from '$lib/workspace/tab-lifecycle-reasons';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    createGlobalTimelineRuntime,
    type GlobalTimelineRuntime,
  } from '$lib/timeline/global-timeline-runtime';
  import {
    createTimelineRuntime,
    type TimelineRuntime,
  } from '$lib/timeline/timeline-runtime';
  import type { TimelineState } from '$lib/timeline/timeline-state';
  import {
    createTimelineSubId,
    relayRuntimeKey,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

  type Props = {
    tabId: string;
    kind?: 'home' | 'global';
    restoreAnchor?: TabFeedAnchor;
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

  $effect(() => {
    if (!props.dataReady) return;
    const nextRelays = timelineRelays(props.relaySets);
    const nextKey = [
      props.kind ?? 'home',
      props.activeAccountPubkey ?? '',
      relayRuntimeKey(nextRelays),
      props.tabId,
    ].join('|');
    if (nextKey === runtimeKey) return;
    closeRuntime('timeline-runtime-recreate');
    olderRequests.reset();
    runtimeKey = nextKey;
    relays = nextRelays;
    runtimeStartedAt = Date.now();
    const options = {
      relays,
      subId: createTimelineSubId(
        props.tabId,
        props.kind === 'global' ? 'global' : 'tl',
      ),
      activeAccountPubkey: props.activeAccountPubkey,
    };
    incMemoryCounter('active-tab-runtimes');
    runtime =
      props.kind === 'global'
        ? createGlobalTimelineRuntime(options)
        : createTimelineRuntime(options);
    appendAppLog({
      area: 'runtime',
      severity: 'info',
      code: 'timeline-runtime-create',
      message: 'Timeline runtime created.',
      context: runtimeContext('create'),
    });
    if (props.kind === 'global') {
      countRuntime('timeline:global', 'created');
      setRuntimeCounterActive('timeline:global', 1);
    } else {
      countRuntime('timeline:home', 'created');
      setRuntimeCounterActive('timeline:home', 1);
    }
    unsubscribe = runtime.subscribe((next) => {
      state = next;
      reportFeedRuntimeWindowSize(next.items.length);
    });
    runtime.start();
  });

  onDestroy(() => closeRuntime('timeline-runtime-destroy'));

  function closeRuntime(code: string): void {
    if (!runtime) return;
    unsubscribe?.();
    runtime.close();
    decMemoryCounter('active-tab-runtimes');
    const reason =
      code === 'timeline-runtime-destroy'
        ? consumeTabCloseReason(props.tabId)
        : code;
    appendAppLog({
      area: 'runtime',
      severity: 'info',
      code,
      message: 'Timeline runtime closed.',
      context: runtimeContext(reason),
    });
    if (props.kind === 'global') {
      countRuntime('timeline:global', 'closed');
      setRuntimeCounterActive('timeline:global', -1);
    } else {
      countRuntime('timeline:home', 'closed');
      setRuntimeCounterActive('timeline:home', -1);
    }
    unsubscribe = undefined;
    runtime = undefined;
  }

  function runtimeContext(reason: string): Record<string, unknown> {
    return {
      tabId: props.tabId,
      kind: props.kind ?? 'home',
      relays: relays.length,
      reason,
      uptimeMs: runtimeStartedAt ? Date.now() - runtimeStartedAt : 0,
      itemCount: state.items.length,
      connectedRelays: state.connectedRelays,
      eoseRelays: state.eoseRelays,
    };
  }
</script>

<section
  class="timeline-tab"
  aria-label={props.kind === 'global' ? 'Global' : 'Home'}
>
  {#if !props.dataReady}
    <p>Loading workspace data...</p>
  {:else if state.loading}
    <p>Loading events...</p>
  {/if}
  {#if state.error}
    <p role="alert">{state.error}</p>
  {/if}
  <EventTreeList
    tabId={props.tabId}
    restoreAnchor={props.restoreAnchor}
    items={state.items}
    profiles={state.profiles}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    loading={state.loading}
    emptyText="No events yet."
    loadingOlder={state.loadingOlder}
    loadingNewer={state.loadingNewer}
    hasOlder={state.hasOlder}
    hasNewer={state.hasNewer}
    onNearEnd={() => olderRequests.requestFromNearEnd()}
    onNearStart={() => runtime?.loadNewer()}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
</section>
