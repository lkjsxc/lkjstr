<script lang="ts">
  import { onMount } from 'svelte';
  import { lookupEvent } from '$lib/events/repository';
  import type { FeedEvent } from '$lib/events/types';
  import type { EventReference } from '$lib/protocol';
  import EventContent from './EventContent.svelte';

  type Props = {
    reference: EventReference;
    depth?: number;
  };

  let props: Props = $props();
  let resolved = $state<FeedEvent | null | undefined>(undefined);

  onMount(async () => {
    resolved = await lookupEvent(props.reference.id);
  });

  function label(): string {
    if (props.reference.kind === 'reply-parent') return 'Replying to';
    if (props.reference.kind === 'reply-root') return 'Thread root';
    if (props.reference.kind === 'quote') return 'Quoted event';
    if (props.reference.kind === 'repost') return 'Reposted event';
    if (props.reference.kind === 'reaction') return 'Reacted to';
    if (props.reference.kind === 'deletion') return 'Deleted target';
    return 'Referenced event';
  }
</script>

<aside class="event-embed" data-kind={props.reference.kind}>
  <strong>{label()}</strong>
  {#if resolved === undefined}
    <p>Loading referenced event...</p>
  {:else if resolved}
    <small>{resolved.event.pubkey.slice(0, 12)}</small>
    <EventContent
      event={resolved.event}
      relays={resolved.relays}
      depth={(props.depth ?? 0) + 1}
    />
  {:else}
    <p>Referenced event not found.</p>
  {/if}
</aside>
