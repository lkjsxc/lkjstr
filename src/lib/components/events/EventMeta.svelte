<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MoreHorizontal } from '@lucide/svelte';
  import type { NostrEvent } from '$lib/protocol';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { feedIdentityDisplay } from '$lib/identity/feed-identity';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { hasOpenProfileAction } from './action-availability';
  import EmojifiedText from './EmojifiedText.svelte';
  import {
    copyEventIdToClipboard,
    copyEventStatusLabel,
    eventMoreMenuHasAuthorContext,
    type EventMoreMenuCopyStatus,
  } from './event-more-menu';

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
  let canOpenProfile = $derived(hasOpenProfileAction(props.openProfile));
  let hasAuthorContext = $derived(
    eventMoreMenuHasAuthorContext(props.openAuthorContext),
  );
  let copyStatus = $state<EventMoreMenuCopyStatus | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (copyTimer) clearTimeout(copyTimer);
  });

  function openProfile(event: MouseEvent): void {
    event.stopPropagation();
    const openProfile = props.openProfile;
    if (!hasOpenProfileAction(openProfile)) return;
    openProfile(props.event.pubkey);
  }

  async function copyEventId(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    copyStatus = await copyEventIdToClipboard(
      props.event.id,
      navigator.clipboard,
    );
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copyStatus = null), 1200);
  }

  function openNearby(event: MouseEvent): void {
    event.stopPropagation();
    const openAuthorContext = props.openAuthorContext;
    if (!eventMoreMenuHasAuthorContext(openAuthorContext)) return;
    openAuthorContext(props.event.id, props.event.pubkey);
  }
</script>

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
      </button>
    {:else}
      <span class="identity-button">
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
      </span>
    {/if}
    <span>{time}</span>
  </div>
  {#if props.showMore}
    <details class="event-more event-action-zone">
      <summary
        aria-label="Event menu"
        onclick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal size={16} />
      </summary>
      <div class="event-more__items">
        {#if hasAuthorContext}
          <button type="button" onclick={openNearby}
            >Nearby posts by this author</button
          >
        {/if}
        <button type="button" onclick={copyEventId}>Copy event ID</button>
        {#if copyStatus}<small role="status"
            >{copyEventStatusLabel(copyStatus)}</small
          >{/if}
      </div>
    </details>
  {/if}
{/if}
