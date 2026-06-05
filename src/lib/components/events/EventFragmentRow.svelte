<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { FlatEventTreeItem } from '$lib/events/tree';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { FeedVisualFragment } from '$lib/feed-surface/feed-visual-fragments';
  import { fragmentEventContent } from '$lib/feed-surface/feed-visual-fragments';
  import type {
    ReactionGroup,
    RepostGroup,
  } from '$lib/thread/thread-reactions';
  import EventActions from './EventActions.svelte';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';
  import EventMoreMenu from './EventMoreMenu.svelte';
  import ReactionSummary from './ReactionSummary.svelte';

  type Props = {
    node: FlatEventTreeItem;
    fragment: FeedVisualFragment;
    profile?: ProfileSummary;
    relaySets?: readonly RelaySet[];
    reactions?: readonly ReactionGroup[];
    reposts?: RepostGroup;
    profiles?: Record<string, ProfileSummary>;
    activeAccountPubkey?: string | null;
    liked?: boolean;
    reposted?: boolean;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let highlighted = $state(false);
  let highlightTimer: ReturnType<typeof setTimeout> | undefined;
  let fragmentEvent = $derived(
    fragmentEventContent(props.node, props.fragment),
  );

  onDestroy(() => {
    if (highlightTimer) clearTimeout(highlightTimer);
  });

  function openRow(event?: MouseEvent): void {
    if (event && shouldKeepLocal(event.target)) return;
    props.openThread?.(props.node.event.id);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') openRow();
  }

  function shouldKeepLocal(target: EventTarget | null): boolean {
    return Boolean(
      target instanceof Element &&
      target.closest('button,a,input,textarea,select,form,.event-action-zone'),
    );
  }

  function openProfile(event: MouseEvent): void {
    event.stopPropagation();
    props.openProfile?.(props.node.event.pubkey);
  }

  function highlightAction(): void {
    highlighted = true;
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => (highlighted = false), 900);
  }
</script>

<div
  class="event-row event-row--fragment"
  class:event-row--action-success={highlighted}
  role="button"
  tabindex="0"
  style={`--event-depth: ${props.node.depth ?? 0}`}
  onclick={openRow}
  onkeydown={handleKeydown}
>
  {#if props.fragment.kind === 'event-header'}
    <button
      type="button"
      class="avatar-button"
      aria-label="Open profile"
      onclick={openProfile}
    >
      <EventMeta
        event={props.node.event}
        relays={[]}
        profile={props.profile}
        avatarOnly
      />
    </button>
    <div class="event-main">
      <EventMeta
        event={props.node.event}
        relays={props.node.relays}
        profile={props.profile}
        openProfile={props.openProfile}
      />
      <EventMoreMenu
        event={props.node.event}
        openAuthorContext={props.openAuthorContext}
      />
    </div>
  {:else}
    <span class="event-fragment-spacer" aria-hidden="true"></span>
    <div class="event-main">
      {#if props.fragment.kind === 'event-actions'}
        <EventActions
          event={props.node.event}
          profile={props.profile}
          activeAccountPubkey={props.activeAccountPubkey}
          liked={props.liked}
          reposted={props.reposted}
          relaySets={props.relaySets ?? []}
          onSuccess={highlightAction}
        />
        <ReactionSummary
          reactions={props.reactions}
          reposts={props.reposts}
          profiles={props.profiles}
          activeAccountPubkey={props.activeAccountPubkey}
          openProfile={props.openProfile}
        />
      {:else}
        <EventContent
          event={fragmentEvent}
          relays={props.node.relays}
          profiles={props.profiles}
          openProfile={props.openProfile}
          openThread={props.openThread}
        />
      {/if}
    </div>
  {/if}
</div>
