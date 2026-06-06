<script lang="ts">
  import {
    eventReferences,
    verifiedNestedRepost,
    type NostrEvent,
  } from '$lib/protocol';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EventContentCore from './EventContentCore.svelte';
  import EventRepostTarget from './EventRepostTarget.svelte';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    depth?: number;
    profiles?: Record<string, ProfileSummary>;
    showSummary?: boolean;
    renderNestedRepost?: boolean;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let nested = $derived(
    props.renderNestedRepost === false
      ? undefined
      : verifiedNestedRepost(props.event),
  );
  let references = $derived(
    (props.depth ?? 0) >= 2
      ? []
      : eventReferences(props.event)
          .filter((reference) => reference.id !== nested?.id)
          .filter((reference) => reference.id !== props.event.id),
  );
</script>

<EventContentCore
  event={props.event}
  {references}
  relays={props.relays}
  profiles={props.profiles}
  showSummary={props.showSummary}
  openProfile={props.openProfile}
  openThread={props.openThread}
/>
{#if nested}
  <EventRepostTarget
    event={nested}
    relays={props.relays}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
