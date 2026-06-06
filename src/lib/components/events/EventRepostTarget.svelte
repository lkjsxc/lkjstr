<script lang="ts">
  import { eventReferences, type NostrEvent } from '$lib/protocol';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EventContentCore from './EventContentCore.svelte';
  import EventMeta from './EventMeta.svelte';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    profiles?: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let references = $derived(
    eventReferences(props.event).filter(
      (reference) => reference.id !== props.event.id,
    ),
  );
</script>

<aside
  class="event-embed"
  data-kind="nested-repost"
  data-event-display-context="repost-target"
>
  <strong class="sr-only">Reposted event</strong>
  <EventMeta
    event={props.event}
    relays={props.relays ?? []}
    profile={props.profiles?.[props.event.pubkey]}
    openProfile={props.openProfile}
  />
  <EventContentCore
    event={props.event}
    {references}
    relays={props.relays}
    profiles={props.profiles}
    showSummary={false}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
</aside>
