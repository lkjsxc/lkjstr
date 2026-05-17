<script lang="ts">
  import type { TimelineItem } from '$lib/timeline/timeline-store';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';

  type Props = {
    item: TimelineItem;
  };

  let props: Props = $props();
  let initials = $derived(props.item.event.pubkey.slice(0, 2).toUpperCase());
</script>

<article class="event-row">
  <div class="avatar fallback" aria-hidden="true">{initials}</div>
  <div class="event-main">
    <EventMeta event={props.item.event} relays={props.item.relays} />
    <EventContent content={props.item.event.content} />
  </div>
</article>
