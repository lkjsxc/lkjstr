<script lang="ts">
  import EventRow from '$lib/components/events/EventRow.svelte';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { TimelineRuntime } from '$lib/timeline/timeline-runtime';
  import type { TimelineState } from '$lib/timeline/timeline-state';
  import {
    createTimelineSubId,
    timelineRelays,
  } from '$lib/timeline/timeline-subscription';

  type Props = {
    tabId: string;
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
  });
  let runtime: TimelineRuntime | undefined;

  $effect(() => {
    const relays = timelineRelays(props.relaySets);
    runtime = new TimelineRuntime({
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
</script>

<section class="timeline-tab" aria-label="Timeline">
  <header class="timeline-status">
    <h2>Home</h2>
    <span>{state.connectedRelays} relays</span>
    <span>{state.eoseRelays} EOSE</span>
    <span>{state.authors.length} authors</span>
    <span>{state.status}</span>
  </header>
  {#if state.loading}
    <p>Loading timeline events...</p>
  {/if}
  {#if state.error}
    <p role="alert">{state.error}</p>
  {/if}
  {#if state.diagnostics.length > 0}
    <ul aria-label="Timeline relay diagnostics">
      {#each state.diagnostics as item (`${item.relay}:${item.timestamp}:${item.message}`)}
        <li>{item.kind}: {item.message}</li>
      {/each}
    </ul>
  {/if}
  <div class="event-list">
    {#each state.items as item (item.event.id)}
      <EventRow
        {item}
        profile={state.profiles[item.event.pubkey]}
        openProfile={props.openProfile}
        openThread={props.openThread}
      />
    {:else}
      {#if !state.loading}
        <p>No timeline events yet.</p>
      {/if}
    {/each}
  </div>
</section>
