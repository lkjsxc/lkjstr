<script lang="ts">
  import { onMount } from 'svelte';
  import {
    resolveReferences,
    type ResolvedReference,
  } from '$lib/events/reference-resolver';
  import type { EventReference } from '$lib/protocol';
  import EventContent from './EventContent.svelte';

  type Props = {
    references: readonly EventReference[];
    relays?: readonly string[];
    depth?: number;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let resolved = $state<ResolvedReference[]>([]);
  let loaded = $state(false);
  let expanded = $state(false);
  let visible = $derived(expanded ? resolved : resolved.slice(0, 4));

  onMount(async () => {
    resolved = await resolveReferences({
      references: props.references,
      relays: props.relays ?? [],
      key: `refs:${props.references.length}:${props.references[0]?.id.slice(0, 12)}`,
    });
    loaded = true;
  });

  function open(id: string, event?: Event): void {
    event?.stopPropagation();
    if (id) props.openThread?.(id);
  }

  function label(reference: EventReference): string {
    if (reference.kind === 'reply-parent') return 'Replying to';
    if (reference.kind === 'reply-root') return 'Referenced event';
    if (reference.kind === 'quote') return 'Quoted event';
    if (reference.kind === 'repost') return 'Reposted event';
    if (reference.kind === 'reaction') return 'Reacted to';
    if (reference.kind === 'deletion') return 'Deleted target';
    return 'Referenced event';
  }
</script>

{#if !loaded && props.references.length > 0}
  <p class="event-list__status">Loading referenced events...</p>
{/if}
{#each visible as reference (`${reference.kind}:${reference.id}`)}
  <div
    class="event-embed"
    data-kind={reference.kind}
    role="button"
    tabindex="0"
    onclick={(event) => open(reference.id, event)}
    onkeydown={(event) => event.key === 'Enter' && open(reference.id, event)}
  >
    <strong>{label(reference)}</strong>
    {#if reference.event}
      <small>{reference.event.event.pubkey.slice(0, 12)}</small>
      <EventContent
        event={reference.event.event}
        relays={reference.event.relays}
        depth={(props.depth ?? 0) + 1}
        openProfile={props.openProfile}
        openThread={props.openThread}
      />
    {:else if loaded}
      <p>Referenced event not found.</p>
    {/if}
  </div>
{/each}
{#if resolved.length > 4}
  <button
    class="content-token"
    type="button"
    onclick={(event) => {
      event.stopPropagation();
      expanded = !expanded;
    }}
  >
    {expanded ? 'Hide references' : `Show all references (${resolved.length})`}
  </button>
{/if}
