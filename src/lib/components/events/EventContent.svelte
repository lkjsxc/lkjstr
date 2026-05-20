<script lang="ts">
  import {
    eventReferences,
    verifiedNestedRepost,
    type NostrEvent,
  } from '$lib/protocol';
  import { actionSummary } from '$lib/events/action-summary';
  import { contentAttachments } from '$lib/events/content-media';
  import ContentTokens from './ContentTokens.svelte';
  import EventEmbed from './EventEmbed.svelte';
  import MediaAttachment from './MediaAttachment.svelte';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    depth?: number;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let nested = $derived(verifiedNestedRepost(props.event));
  let summary = $derived(actionSummary(props.event));
  let references = $derived(
    (props.depth ?? 0) >= 1
      ? []
      : eventReferences(props.event)
          .filter((reference) => reference.id !== nested?.id)
          .slice(0, 4),
  );
  let attachments = $derived(
    contentAttachments(props.event).filter((item) => item.type !== 'link'),
  );
</script>

{#if summary}
  <p class="event-content action-summary">
    <strong>{summary.verb}</strong>{#if summary.detail}
      {summary.detail}{/if}
  </p>
{:else}
  <ContentTokens
    event={props.event}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
{#if !summary && attachments.length > 0}
  <div class="media-grid">
    {#each attachments as attachment (attachment.url)}
      <MediaAttachment {attachment} />
    {/each}
  </div>
{/if}
{#if nested}
  <aside class="event-embed" data-kind="nested-repost">
    <strong>Reposted event</strong>
    <small>{nested.pubkey.slice(0, 12)}</small>
    <ContentTokens
      event={nested}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
  </aside>
{/if}
{#each references as reference (`${reference.kind}:${reference.id}`)}
  <EventEmbed
    {reference}
    relays={props.relays ?? []}
    depth={props.depth ?? 0}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/each}
