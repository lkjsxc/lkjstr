<script lang="ts">
  import { onMount } from 'svelte';
  import { lookupEvent, upsertEvent } from '$lib/events/repository';
  import { readRelayPage } from '$lib/events/relay-page';
  import type { FeedEvent } from '$lib/events/types';
  import type { EventReference } from '$lib/protocol';
  import { sharedSubscriptionManager } from '$lib/relays/subscription-manager';
  import EventContent from './EventContent.svelte';

  type Props = {
    reference: EventReference;
    relays?: readonly string[];
    depth?: number;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let resolved = $state<FeedEvent | null | undefined>(undefined);

  onMount(async () => {
    resolved = await resolve();
  });

  async function resolve(): Promise<FeedEvent | null> {
    const cached = await lookupEvent(props.reference.id);
    if (cached || !props.relays?.length) return cached ?? null;
    const [hit] = await readRelayPage({
      key: `embed:${props.reference.id}`,
      relays: props.relays,
      filters: [{ ids: [props.reference.id] }],
      pageSize: 1,
      subscriptions: sharedSubscriptionManager,
    });
    if (!hit) return null;
    await upsertEvent(hit.event, [hit.relay]);
    return { event: hit.event, relays: [hit.relay] };
  }

  function open(event: MouseEvent): void {
    event.stopPropagation();
    props.openThread?.(props.reference.id);
  }

  function label(): string {
    if (props.reference.kind === 'reply-parent') return 'Replying to';
    if (props.reference.kind === 'reply-root') return 'Referenced event';
    if (props.reference.kind === 'quote') return 'Quoted event';
    if (props.reference.kind === 'repost') return 'Reposted event';
    if (props.reference.kind === 'reaction') return 'Reacted to';
    if (props.reference.kind === 'deletion') return 'Deleted target';
    return 'Referenced event';
  }
</script>

<div
  class="event-embed"
  data-kind={props.reference.kind}
  role="button"
  tabindex="0"
  onclick={open}
  onkeydown={(event) =>
    event.key === 'Enter' && props.openThread?.(props.reference.id)}
>
  <strong>{label()}</strong>
  {#if resolved === undefined}
    <p>Loading referenced event...</p>
  {:else if resolved}
    <small>{resolved.event.pubkey.slice(0, 12)}</small>
    <EventContent
      event={resolved.event}
      relays={resolved.relays}
      depth={(props.depth ?? 0) + 1}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
  {:else}
    <p>Referenced event not found.</p>
  {/if}
</div>
