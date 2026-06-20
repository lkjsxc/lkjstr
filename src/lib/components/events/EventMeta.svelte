<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MoreHorizontal } from '@lucide/svelte';
  import type { NostrEvent } from '$lib/protocol';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { feedIdentityDisplay } from '$lib/identity/feed-identity';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EmojifiedText from './EmojifiedText.svelte';
  import {
    eventProfileCanOpen,
    stopAndOpenEventProfile,
  } from './event-profile-activation';
  import {
    createEventMetaCopyStatusResetter,
    eventMetaCopyStatusLabel,
    type EventMetaCopyStatus,
  } from './event-meta-copy-status';
  import {
    copyEventMetaEventId,
    eventMetaHasAuthorContext,
    eventMetaOverflowLabels,
    openEventMetaAuthorContext,
    stopEventMetaOverflowPropagation,
  } from './event-meta-overflow';

  type Props = {
    event: NostrEvent;
    relays: readonly string[];
    profile?: ProfileSummary;
    avatarOnly?: boolean;
    avatarInline?: boolean;
    showMore?: boolean;
    openProfile?: (pubkey: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let display = $derived(
    feedIdentityDisplay(props.event.pubkey, props.profile),
  );
  let time = $derived(new Date(props.event.created_at * 1000).toLocaleString());
  let canOpenProfile = $derived(eventProfileCanOpen(props.openProfile));
  let hasAuthorContext = $derived(
    eventMetaHasAuthorContext(props.openAuthorContext),
  );
  const overflowLabels = eventMetaOverflowLabels();
  let copyStatus = $state<EventMetaCopyStatus | null>(null);
  const copyStatusResetter = createEventMetaCopyStatusResetter(
    (status) => (copyStatus = status),
  );

  onDestroy(() => {
    copyStatusResetter.clear();
  });

  function openProfile(event: MouseEvent): void {
    stopAndOpenEventProfile(event, props.openProfile, props.event.pubkey);
  }

  async function copyEventId(event: MouseEvent): Promise<void> {
    const status = await copyEventMetaEventId(
      event,
      props.event.id,
      navigator.clipboard,
    );
    copyStatusResetter.show(status);
  }

  function openNearby(event: MouseEvent): void {
    openEventMetaAuthorContext(
      event,
      props.openAuthorContext,
      props.event.id,
      props.event.pubkey,
    );
  }
</script>

{#snippet identityBody()}
  {#if props.avatarInline}
    <Avatar
      pubkey={display.pubkey}
      name={display.title}
      src={display.avatarUrl}
      size="sm"
    />
  {/if}
  <strong>
    <EmojifiedText
      text={display.title}
      emojis={props.profile?.customEmojis ?? []}
    />
  </strong>
  {#if display.subtitle}<small>{display.subtitle}</small>{/if}
{/snippet}

{#if props.avatarOnly}
  <Avatar
    pubkey={display.pubkey}
    name={display.title}
    src={display.avatarUrl}
  />
{:else}
  <div class="event-meta">
    {#if canOpenProfile}
      <button type="button" class="identity-button" onclick={openProfile}>
        {@render identityBody()}
      </button>
    {:else}
      <span class="identity-button">
        {@render identityBody()}
      </span>
    {/if}
    <span>{time}</span>
  </div>
  {#if props.showMore}
    <details class="event-more event-action-zone">
      <summary
        aria-label={overflowLabels.menu}
        onclick={stopEventMetaOverflowPropagation}
      >
        <MoreHorizontal size={16} />
      </summary>
      <div class="event-more__items">
        {#if hasAuthorContext}
          <button type="button" onclick={openNearby}
            >{overflowLabels.nearbyAuthor}</button
          >
        {/if}
        <button type="button" onclick={copyEventId}
          >{overflowLabels.copyEventId}</button
        >
        {#if copyStatus}<small role="status"
            >{eventMetaCopyStatusLabel(copyStatus)}</small
          >{/if}
      </div>
    </details>
  {/if}
{/if}
