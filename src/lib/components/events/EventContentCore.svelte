<script lang="ts">
  import { onMount } from 'svelte';
  import {
    contentWarningReason,
    hasContentWarning,
    type EventReference,
    type NostrEvent,
  } from '$lib/protocol';
  import { actionSummary } from '$lib/events/action-summary';
  import { contentAttachments } from '$lib/events/content-media';
  import type { ProfileSummary } from '$lib/identity/identity';
  import ContentTokens from './ContentTokens.svelte';
  import EventReferences from './EventReferences.svelte';
  import MediaAttachment from './MediaAttachment.svelte';
  import { subscribeHideSensitiveEvents } from '$lib/settings/settings-store';
  import {
    isSensitiveEventRevealed,
    revealSensitiveEvent,
  } from '$lib/events/sensitive-reveal';
  import EmojifiedText from './EmojifiedText.svelte';

  type Props = {
    event: NostrEvent;
    references: readonly EventReference[];
    relays?: readonly string[];
    profiles?: Record<string, ProfileSummary>;
    showSummary?: boolean;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let hideSensitive = $state(true);
  let revealed = $derived(isSensitiveEventRevealed(props.event.id));
  let summary = $derived(
    props.showSummary === false ? undefined : actionSummary(props.event),
  );
  let sensitive = $derived(hasContentWarning(props.event));
  let reason = $derived(contentWarningReason(props.event) ?? '');
  let gated = $derived(sensitive && hideSensitive && !revealed);
  let referenceIds = $derived(new Set(props.references.map((item) => item.id)));
  let attachments = $derived(
    contentAttachments(props.event).filter((item) => item.type !== 'link'),
  );

  onMount(() => {
    const unsubscribe = subscribeHideSensitiveEvents(
      (value) => (hideSensitive = value),
    );
    return unsubscribe;
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
        revealSensitiveEvent(props.event.id);
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
        {#if summary.reaction?.emoji}
          <EmojifiedText
            text={` ${summary.detail}`}
            emojis={[summary.reaction.emoji]}
          />
        {:else}
          {` ${summary.detail}`}
        {/if}{/if}
    </p>
  {:else}
    <ContentTokens
      event={props.event}
      relays={props.relays}
      profiles={props.profiles}
      hiddenEventIds={referenceIds}
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
  <EventReferences
    references={props.references}
    relays={props.relays ?? []}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
