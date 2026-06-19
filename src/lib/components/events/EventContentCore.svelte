<script lang="ts">
  import { onMount } from 'svelte';
  import { type EventReference, type NostrEvent } from '$lib/protocol';
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
  import {
    planEventContentCore,
    revealEventContent,
  } from './event-content-plan';

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
  let plan = $derived(
    planEventContentCore(props.event, props.references, {
      hideSensitive,
      revealed,
      showSummary: props.showSummary,
    }),
  );

  onMount(() => {
    const unsubscribe = subscribeHideSensitiveEvents(
      (value) => (hideSensitive = value),
    );
    return unsubscribe;
  });
</script>

{#if plan.sensitivity.gated}
  <aside class="content-warning">
    <strong>{plan.sensitivity.label}</strong>
    {#if plan.sensitivity.reason}<span>{plan.sensitivity.reason}</span>{/if}
    <button
      type="button"
      onclick={(event) => {
        revealed = revealEventContent(event, () =>
          revealSensitiveEvent(props.event.id),
        );
      }}>{plan.sensitivity.revealLabel}</button
    >
  </aside>
{:else}
  {#if plan.sensitivity.showBadge}
    <p class="content-warning-badge">{plan.sensitivity.label}</p>
  {/if}
  {#if plan.summary}
    <p class="event-content action-summary">
      <strong>{plan.summary.verb}</strong>{#if plan.summary.detail}
        {#if plan.summary.reaction?.emoji}
          <EmojifiedText
            text={` ${plan.summary.detail}`}
            emojis={[plan.summary.reaction.emoji]}
          />
        {:else}
          {` ${plan.summary.detail}`}
        {/if}{/if}
    </p>
  {:else}
    <ContentTokens
      event={props.event}
      relays={props.relays}
      profiles={props.profiles}
      hiddenEventIds={plan.referenceIds}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
  {/if}
  {#if !plan.summary && plan.attachments.length > 0}
    <div class="media-grid">
      {#each plan.attachments as attachment (attachment.url)}
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
