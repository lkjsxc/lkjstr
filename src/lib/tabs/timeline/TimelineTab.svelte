<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import EventRow from '$lib/components/events/EventRow.svelte';
  import type { RelaySet } from '$lib/relays/relay-store';
  import {
    TimelineRuntime,
    type TimelineState,
  } from '$lib/timeline/timeline-runtime';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';

  type Props = {
    tabId: string;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let state = $state<TimelineState>({
    items: [],
    loading: true,
    error: null,
    connectedRelays: 0,
    eoseRelays: 0,
  });
  let runtime: TimelineRuntime | undefined;

  onMount(() => {
    runtime = new TimelineRuntime({
      relays: timelineRelays(props.relaySets),
      subId: createTimelineSubId(props.tabId),
    });
    const unsubscribe = runtime.subscribe((next) => (state = next));
    runtime.start();
    return () => {
      unsubscribe();
      runtime?.close();
    };
  });

  onDestroy(() => runtime?.close());
</script>

<section class="timeline-tab" aria-label="Timeline">
  <header class="timeline-status">
    <h2>Home</h2>
    <span>{state.connectedRelays} relays</span>
    <span>{state.eoseRelays} EOSE</span>
  </header>
  {#if state.loading}
    <p>Loading timeline events...</p>
  {/if}
  {#if state.error}
    <p role="alert">{state.error}</p>
  {/if}
  <div class="event-list">
    {#each state.items as item (item.event.id)}
      <EventRow {item} />
    {:else}
      {#if !state.loading}
        <p>No timeline events yet.</p>
      {/if}
    {/each}
  </div>
</section>
