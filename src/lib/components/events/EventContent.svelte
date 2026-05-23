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
  import type { ProfileSummary } from '$lib/identity/identity';
  import ContentTokens from './ContentTokens.svelte';
  import EventReferences from './EventReferences.svelte';
  import EventMeta from './EventMeta.svelte';
  import MediaAttachment from './MediaAttachment.svelte';
  import { loadSettings } from '$lib/settings/settings-store';
  import {
    isSensitiveEventRevealed,
    revealSensitiveEvent,
  } from '$lib/events/sensitive-reveal';
  import EmojifiedText from './EmojifiedText.svelte';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    depth?: number;
    profiles?: Record<string, ProfileSummary>;
    showSummary?: boolean;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let hideSensitive = $state(true);
  let revealed = $derived(isSensitiveEventRevealed(props.event.id));
  let nested = $derived(verifiedNestedRepost(props.event));
  let summary = $derived(
    props.showSummary === false ? undefined : actionSummary(props.event),
  );
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
  let referenceIds = $derived(new Set(references.map((item) => item.id)));
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
          <span>
            <EmojifiedText
              text={summary.detail}
              emojis={[summary.reaction.emoji]}
            />
          </span>
        {:else}
          <span>{summary.detail}</span>
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
  {#if nested}
    <aside class="event-embed" data-kind="nested-repost">
      <strong class="sr-only">Reposted event</strong>
      <EventMeta
        event={nested}
        relays={[]}
        profile={props.profiles?.[nested.pubkey]}
        openProfile={props.openProfile}
      />
      <ContentTokens
        event={nested}
        relays={props.relays}
        profiles={props.profiles}
        openProfile={props.openProfile}
        openThread={props.openThread}
      />
    </aside>
  {/if}
  <EventReferences
    {references}
    relays={props.relays ?? []}
    depth={props.depth ?? 0}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
