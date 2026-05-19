<script lang="ts">
  import type { TimelineItem } from '$lib/timeline/timeline-store';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';

  type Props = {
    item: TimelineItem;
    depth?: number;
    profile?: ProfileSummary;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
</script>

<article class="event-row" style={`--event-depth: ${props.depth ?? 0}`}>
  <button
    type="button"
    class="avatar-button"
    aria-label="Open profile"
    onclick={() => props.openProfile?.(props.item.event.pubkey)}
  >
    <EventMeta
      event={props.item.event}
      relays={[]}
      profile={props.profile}
      avatarOnly
    />
  </button>
  <div class="event-main">
    <EventMeta
      event={props.item.event}
      relays={props.item.relays}
      profile={props.profile}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
    <EventContent event={props.item.event} relays={props.item.relays} />
  </div>
</article>
