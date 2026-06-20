<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { FlatEventTreeItem } from '$lib/events/tree';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { FeedVisualFragment } from '$lib/feed-surface/feed-visual-fragments';
  import { fragmentEventContent } from '$lib/feed-surface/feed-visual-fragments';
  import {
    recordFeedFragmentMounted,
    recordFeedFragmentUnmounted,
  } from '$lib/feed-surface/feed-fragment-diagnostics';
  import type {
    ReactionGroup,
    RepostGroup,
  } from '$lib/thread/thread-reactions';
  import EventActions from './EventActions.svelte';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';
  import EventRowAvatar from './EventRowAvatar.svelte';
  import EventRowFrame from './EventRowFrame.svelte';
  import ReactionSummary from './ReactionSummary.svelte';
  import {
    createEventRowSuccessHighlighter,
    openEventThreadFromRowClick,
    openEventThreadFromRowKey,
  } from './event-row-activation';
  import { planEventRowPresentation } from './event-row-presentation-plan';

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
  const successHighlighter = createEventRowSuccessHighlighter(
    (next) => (highlighted = next),
  );
  let fragmentEvent = $derived(
    fragmentEventContent(props.node, props.fragment),
  );
  let presentation = $derived(
    planEventRowPresentation({
      depth: props.node.depth,
      openProfile: props.openProfile,
      openThread: props.openThread,
    }),
  );

  onMount(() => {
    recordFeedFragmentMounted();
    return () => recordFeedFragmentUnmounted();
  });

  onDestroy(() => {
    successHighlighter.destroy();
  });

  function openRow(event?: MouseEvent): void {
    openEventThreadFromRowClick(event, props.openThread, props.node.event.id);
  }

  function handleKeydown(event: KeyboardEvent): void {
    openEventThreadFromRowKey(event, props.openThread, props.node.event.id);
  }

  function highlightAction(): void {
    successHighlighter.trigger();
  }
</script>

<EventRowFrame
  depthStyle={presentation.depthStyle}
  fragment
  {highlighted}
  interactive={presentation.thread.openable}
  onRowClick={openRow}
  onRowKeydown={handleKeydown}
>
  {#if props.fragment.kind === 'event-header'}
    <EventRowAvatar
      event={props.node.event}
      profile={props.profile}
      presentation={presentation.profile}
      openProfile={props.openProfile}
    />
    <div class="event-main">
      <EventMeta
        event={props.node.event}
        relays={props.node.relays}
        profile={props.profile}
        openProfile={props.openProfile}
        showMore
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
</EventRowFrame>
