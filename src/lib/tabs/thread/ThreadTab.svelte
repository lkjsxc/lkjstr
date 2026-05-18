<script lang="ts">
  import EventRow from '$lib/components/events/EventRow.svelte';
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
  });

  $effect(() => {
    if (!props.eventId) return;
    const runtime = new ThreadRuntime(
      props.eventId,
      timelineRelays(props.relaySets),
      createTimelineSubId(props.tabId),
    );
    const unsubscribe = runtime.subscribe((next) => (state = next));
    runtime.start();
    return () => {
      unsubscribe();
      runtime.close();
    };
  });
</script>

<section class="data-tab">
  <h2>Thread</h2>
  {#if props.eventId}
    <p>Thread root: {props.eventId}</p>
    {#if state.loading}<p>Loading thread...</p>{/if}
    {#if state.error}<p role="alert">{state.error}</p>{/if}
    <div class="event-list">
      {#each state.items as item (item.event.id)}
        <EventRow {item} />
      {:else}
        {#if !state.loading}<p>No thread events found.</p>{/if}
      {/each}
    </div>
  {:else}
    <p>Open threads from a timeline event.</p>
  {/if}
</section>
