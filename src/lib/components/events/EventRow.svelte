<script lang="ts">
  import type { TimelineItem } from '$lib/timeline/timeline-store';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';

  type Props = {
    item: TimelineItem;
    depth?: number;
    profile?: ProfileSummary;
    fullEventId?: boolean;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let profile = $derived(
    props.profile?.pubkey === props.item.event.pubkey
      ? props.profile
      : undefined,
  );

  function openRow(): void {
    props.openThread?.(props.item.event.id);
  }

  function openProfile(event: MouseEvent): void {
    event.stopPropagation();
    props.openProfile?.(props.item.event.pubkey);
  }
</script>

<div
  class="event-row"
  role="button"
  tabindex="0"
  style={`--event-depth: ${props.depth ?? 0}`}
  onclick={openRow}
  onkeydown={(event) => event.key === 'Enter' && openRow()}
>
  <button
    type="button"
    class="avatar-button"
    aria-label="Open profile"
    onclick={openProfile}
  >
    <EventMeta event={props.item.event} relays={[]} {profile} avatarOnly />
  </button>
  <div class="event-main">
    <EventMeta
      event={props.item.event}
      relays={props.item.relays}
      {profile}
      fullEventId={props.fullEventId}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
    <EventContent
      event={props.item.event}
      relays={props.item.relays}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
  </div>
</div>
