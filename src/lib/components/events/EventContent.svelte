<script lang="ts">
  import { onMount } from 'svelte';
  import {
    contentWarningReason,
    eventReferences,
    hasContentWarning,
    verifiedNestedRepost,
    type NostrEvent,
  } from '$lib/protocol';
  import { actionSummary } from '$lib/events/action-summary';
  import { contentAttachments } from '$lib/events/content-media';
  import ContentTokens from './ContentTokens.svelte';
  import EventReferences from './EventReferences.svelte';
  import MediaAttachment from './MediaAttachment.svelte';
  import { loadSettings } from '$lib/settings/settings-store';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    depth?: number;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let hideSensitive = $state(true);
  let revealed = $state(false);
  let nested = $derived(verifiedNestedRepost(props.event));
  let summary = $derived(actionSummary(props.event));
  let sensitive = $derived(hasContentWarning(props.event));
  let reason = $derived(contentWarningReason(props.event) ?? '');
  let gated = $derived(sensitive && hideSensitive && !revealed);
  let references = $derived(
    (props.depth ?? 0) >= 1
      ? []
      : eventReferences(props.event)
          .filter((reference) => reference.id !== nested?.id)
          .filter((reference) => reference.id !== props.event.id),
  );
  let attachments = $derived(
    contentAttachments(props.event).filter((item) => item.type !== 'link'),
  );

  onMount(async () => {
    const settings = await loadSettings();
    const setting = settings.find(
      (item) => item.key === 'content.hideSensitiveEvents',
    );
    hideSensitive = setting?.value !== false;
  });
</script>

{#if gated}
  <aside class="content-warning">
    <strong>Sensitive content</strong>
    {#if reason}<span>{reason}</span>{/if}
    <button
      type="button"
      onclick={(event) => {
        event.stopPropagation();
        revealed = true;
      }}>Reveal</button
    >
  </aside>
{:else}
  {#if sensitive && !hideSensitive}
    <p class="content-warning-badge">Sensitive content</p>
  {/if}
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
  <EventReferences
    {references}
    relays={props.relays ?? []}
    depth={props.depth ?? 0}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
