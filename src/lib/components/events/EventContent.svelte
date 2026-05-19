<script lang="ts">
  import {
    eventReferences,
    verifiedNestedRepost,
    type NostrEvent,
  } from '$lib/protocol';
  import { contentAttachments } from '$lib/events/content-media';
  import EventEmbed from './EventEmbed.svelte';
  import MediaAttachment from './MediaAttachment.svelte';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    depth?: number;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let nested = $derived(verifiedNestedRepost(props.event));
  let references = $derived(
    (props.depth ?? 0) >= 1 ? [] : eventReferences(props.event).slice(0, 4),
  );
  let attachments = $derived(contentAttachments(props.event));
</script>

<p class="event-content">{props.event.content}</p>
{#if attachments.length > 0}
  <div class="media-grid">
    {#each attachments as attachment (attachment.url)}
      <MediaAttachment {attachment} />
    {/each}
  </div>
{/if}
{#if nested}
  <aside class="event-embed" data-kind="repost-json">
    <strong>Reposted event</strong>
    <small>{nested.pubkey.slice(0, 12)}</small>
    <p class="event-content">{nested.content}</p>
  </aside>
{/if}
{#each references as reference (`${reference.kind}:${reference.id}`)}
  <EventEmbed
    {reference}
    relays={props.relays ?? []}
    depth={props.depth ?? 0}
    openThread={props.openThread}
  />
{/each}
