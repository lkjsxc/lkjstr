<script lang="ts">
  import EventTreeList from '$lib/components/events/EventTreeList.svelte';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { ThreadRuntime, type ThreadState } from '$lib/thread/thread-runtime';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';

  type Props = {
    tabId: string;
    eventId?: string;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
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
</script>

<section class="data-tab">
  <h2>Thread</h2>
  {#if props.eventId}
    {#if state.loading}<p>Loading thread...</p>{/if}
    {#if state.error}<p role="alert">{state.error}</p>{/if}
    <EventTreeList
      items={state.items}
      loading={state.loading}
      loadingOlder={state.loadingOlder}
      hasOlder={state.hasOlder}
      newerPruned={state.newerPruned}
      onNearEnd={() => runtime?.loadOlder()}
      resetToLatest={() => runtime?.resetToLatest()}
      emptyText="No thread events found."
    />
  {:else}
    <p>Open threads from a timeline event.</p>
  {/if}
</section>
