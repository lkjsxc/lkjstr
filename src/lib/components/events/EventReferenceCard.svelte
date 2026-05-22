<script lang="ts">
  import { customEmojis, type EventReference } from '$lib/protocol';
  import { contentAttachments } from '$lib/events/content-media';
  import { eventReferenceLabel } from '$lib/events/reference-label';
  import type { ResolvedReference } from '$lib/events/reference-resolver';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EmojifiedText from './EmojifiedText.svelte';
  import EventMeta from './EventMeta.svelte';

  type Props = {
    reference: ResolvedReference;
    profiles: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let event = $derived(props.reference.event?.event);
  let preview = $derived(event?.content.trim().replace(/\s+/gu, ' '));
  let mediaCount = $derived(event ? contentAttachments(event).length : 0);

  function open(id: string, domEvent?: Event): void {
    domEvent?.stopPropagation();
    props.openThread?.(id);
  }
</script>

<div
  class="event-embed"
  data-kind={props.reference.kind}
  role="button"
  tabindex="0"
  onclick={(event) => open(props.reference.id, event)}
  onkeydown={(event) =>
    event.key === 'Enter' && open(props.reference.id, event)}
>
  <strong>{eventReferenceLabel(props.reference as EventReference)}</strong>
  {#if event}
    <EventMeta
      {event}
      relays={props.reference.event?.relays ?? []}
      profile={props.profiles[event.pubkey]}
      openProfile={props.openProfile}
    />
    {#if preview}
      <p class="event-content">
        <EmojifiedText text={preview} emojis={customEmojis(event)} />
      </p>
    {/if}
    {#if mediaCount > 0}<small>{mediaCount} media attachment(s)</small>{/if}
  {:else}
    <p>Referenced event not found.</p>
  {/if}
</div>
