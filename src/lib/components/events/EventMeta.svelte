<script lang="ts">
  import type { NostrEvent } from '$lib/protocol';

  type Props = {
    event: NostrEvent;
    relays: readonly string[];
  };

  let props: Props = $props();
  let author = $derived(short(props.event.pubkey));
  let eventId = $derived(short(props.event.id));
  let time = $derived(new Date(props.event.created_at * 1000).toLocaleString());
  let relayText = $derived(props.relays.join(', '));

  function short(value: string): string {
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  }
</script>

<div class="event-meta">
  <strong>{author}</strong>
  <span>{time}</span>
  <span>{eventId}</span>
  <span>{relayText}</span>
</div>
