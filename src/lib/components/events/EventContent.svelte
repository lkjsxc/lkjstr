<script lang="ts">
  import {
    eventReferences,
    verifiedNestedRepost,
    type NostrEvent,
  } from '$lib/protocol';
  import EventEmbed from './EventEmbed.svelte';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    depth?: number;
  };

  let props: Props = $props();
  let nested = $derived(verifiedNestedRepost(props.event));
  let references = $derived(
    (props.depth ?? 0) >= 1 ? [] : eventReferences(props.event).slice(0, 4),
  );
</script>

<p class="event-content">{props.event.content}</p>
{#if nested}
  <aside class="event-embed" data-kind="repost-json">
    <strong>Reposted event</strong>
    <small>{nested.pubkey.slice(0, 12)}</small>
    <p class="event-content">{nested.content}</p>
  </aside>
{/if}
{#each references as reference (`${reference.kind}:${reference.id}`)}
  <EventEmbed {reference} depth={props.depth ?? 0} />
{/each}
