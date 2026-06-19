<script lang="ts">
  import { type NostrEvent } from '$lib/protocol';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EventContentCore from './EventContentCore.svelte';
  import EventRepostTarget from './EventRepostTarget.svelte';
  import { planEventContent } from './event-content-plan';

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
  let plan = $derived(
    planEventContent(props.event, {
      depth: props.depth,
      renderNestedRepost: props.renderNestedRepost,
    }),
  );
</script>

<EventContentCore
  event={props.event}
  references={plan.references}
  relays={props.relays}
  profiles={props.profiles}
  showSummary={props.showSummary}
  openProfile={props.openProfile}
  openThread={props.openThread}
/>
{#if plan.nested}
  <EventRepostTarget
    event={plan.nested}
    relays={props.relays}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
