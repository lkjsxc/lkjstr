<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { TimelineItem } from '$lib/timeline/timeline-store';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import EventContent from './EventContent.svelte';
  import EventMeta from './EventMeta.svelte';
  import EventActions from './EventActions.svelte';
  import EventRowAvatar from './EventRowAvatar.svelte';
  import EventRowFrame from './EventRowFrame.svelte';
  import ReactionSummary from './ReactionSummary.svelte';
  import {
    createEventRowSuccessHighlighter,
    openEventThreadFromRowClick,
    openEventThreadFromRowKey,
  } from './event-row-activation';
  import { planEventRowPresentation } from './event-row-presentation-plan';
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
  let presentation = $derived(
    planEventRowPresentation({
      depth: props.depth,
      openProfile: props.openProfile,
      openThread: props.openThread,
    }),
  );

  onDestroy(() => {
    successHighlighter.destroy();
  });

  function openRow(event?: MouseEvent): void {
    openEventThreadFromRowClick(event, props.openThread, props.item.event.id);
  }

  function handleKeydown(event: KeyboardEvent): void {
    openEventThreadFromRowKey(event, props.openThread, props.item.event.id);
  }

  function highlightAction(): void {
    successHighlighter.trigger();
  }
</script>

<EventRowFrame
  depthStyle={presentation.depthStyle}
  embedded={props.showSeparator === false}
  {highlighted}
  interactive={presentation.thread.openable}
  onRowClick={openRow}
  onRowKeydown={handleKeydown}
  compact={props.compact}
>
  <EventRowAvatar
    event={props.item.event}
    {profile}
    presentation={presentation.profile}
    openProfile={props.openProfile}
  />
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
</EventRowFrame>
