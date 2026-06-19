<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { TimelineItem } from '$lib/timeline/timeline-store';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';
  import EventActions from './EventActions.svelte';
  import ReactionSummary from './ReactionSummary.svelte';
  import {
    eventProfileCanOpen,
    eventProfileOpenLabel,
    stopAndOpenEventProfile,
  } from './event-profile-activation';
  import {
    createEventRowSuccessHighlighter,
    eventRowCanOpenThread,
    openEventThreadFromRowClick,
    openEventThreadFromRowKey,
  } from './event-row-activation';
  import type {
    ReactionGroup,
    RepostGroup,
  } from '$lib/thread/thread-reactions';

  type Props = {
    item: TimelineItem;
    depth?: number;
    profile?: ProfileSummary;
    relaySets?: readonly RelaySet[];
    reactions?: readonly ReactionGroup[];
    reposts?: RepostGroup;
    profiles?: Record<string, ProfileSummary>;
    activeAccountPubkey?: string | null;
    liked?: boolean;
    reposted?: boolean;
    compact?: boolean;
    showSeparator?: boolean;
    showActions?: boolean;
    showSummary?: boolean;
    showMore?: boolean;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let profile = $derived(
    props.profile?.pubkey === props.item.event.pubkey
      ? props.profile
      : undefined,
  );
  let highlighted = $state(false);
  const successHighlighter = createEventRowSuccessHighlighter(
    (next) => (highlighted = next),
  );
  const profileOpenLabel = eventProfileOpenLabel();
  let canOpenProfile = $derived(eventProfileCanOpen(props.openProfile));
  let canOpenThread = $derived(eventRowCanOpenThread(props.openThread));

  onDestroy(() => {
    successHighlighter.destroy();
  });

  function openRow(event?: MouseEvent): void {
    openEventThreadFromRowClick(event, props.openThread, props.item.event.id);
  }

  function handleKeydown(event: KeyboardEvent): void {
    openEventThreadFromRowKey(event, props.openThread, props.item.event.id);
  }

  function openProfile(event: MouseEvent): void {
    stopAndOpenEventProfile(event, props.openProfile, props.item.event.pubkey);
  }

  function highlightAction(): void {
    successHighlighter.trigger();
  }
</script>

{#snippet rowBody()}
  {#if canOpenProfile}
    <button
      type="button"
      class="avatar-button"
      aria-label={profileOpenLabel}
      onclick={openProfile}
    >
      <EventMeta event={props.item.event} relays={[]} {profile} avatarOnly />
    </button>
  {:else}
    <span class="avatar-button">
      <EventMeta event={props.item.event} relays={[]} {profile} avatarOnly />
    </span>
  {/if}
  <div class="event-main">
    <EventMeta
      event={props.item.event}
      relays={props.item.relays}
      {profile}
      openProfile={props.openProfile}
      showMore={props.showMore !== false}
      openAuthorContext={props.openAuthorContext}
    />
    <EventContent
      event={props.item.event}
      relays={props.item.relays}
      profiles={props.profiles}
      showSummary={props.showSummary}
      openProfile={props.openProfile}
      openThread={props.openThread}
    />
    {#if props.showActions !== false}
      <EventActions
        event={props.item.event}
        {profile}
        activeAccountPubkey={props.activeAccountPubkey}
        liked={props.liked}
        reposted={props.reposted}
        relaySets={props.relaySets ?? []}
        onSuccess={highlightAction}
      />
    {/if}
    <ReactionSummary
      reactions={props.reactions}
      reposts={props.reposts}
      profiles={props.profiles}
      activeAccountPubkey={props.activeAccountPubkey}
      openProfile={props.openProfile}
    />
  </div>
{/snippet}

{#if canOpenThread}
  <div
    class="event-row event-row--interactive"
    class:event-row--compact={props.compact}
    class:event-row--embedded={props.showSeparator === false}
    class:event-row--action-success={highlighted}
    role="button"
    tabindex="0"
    style={`--event-depth: ${props.depth ?? 0}`}
    onclick={openRow}
    onkeydown={handleKeydown}
  >
    {@render rowBody()}
  </div>
{:else}
  <div
    class="event-row"
    class:event-row--compact={props.compact}
    class:event-row--embedded={props.showSeparator === false}
    class:event-row--action-success={highlighted}
    style={`--event-depth: ${props.depth ?? 0}`}
  >
    {@render rowBody()}
  </div>
{/if}
