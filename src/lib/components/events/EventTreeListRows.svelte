<script lang="ts">
  import type { Snippet } from 'svelte';
  import FeedSurfaceStatus from './FeedSurfaceStatus.svelte';
  import type { FeedPagingPhase } from '$lib/feed-surface/paging-state';
  import EventFragmentRow from './EventFragmentRow.svelte';
  import EventRow from './EventRow.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type {
    ReactionSummaryMap,
    RepostSummaryMap,
  } from '$lib/thread/thread-reactions';
  import type { EventActionState } from '$lib/events/action-state';
  import { actionStateForEvent } from '$lib/events/action-state';
  import { hasOpenThreadAction } from './action-availability';
  import type {
    EventTreeListLeadingRow,
    EventTreeListViewRow,
  } from './event-tree-list-helpers';

  type Props = {
    node: EventTreeListViewRow;
    phase?: FeedPagingPhase;
    profiles?: Record<string, ProfileSummary>;
    relaySets?: readonly RelaySet[];
    activeAccountPubkey?: string | null;
    reactions?: ReactionSummaryMap;
    reposts?: RepostSummaryMap;
    actionStates: Map<string, EventActionState>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
    leadingRow?: Snippet<[EventTreeListLeadingRow]>;
  };

  let props: Props = $props();
  let eventNode = $derived(
    props.node.kind === 'event' ? props.node.node : undefined,
  );
  let collapsed = $derived(
    eventNode && 'collapsed' in eventNode ? eventNode : undefined,
  );
  let canOpenThread = $derived(hasOpenThreadAction(props.openThread));
</script>

{#if props.node.kind === 'leading'}
  {#if props.leadingRow}
    {@render props.leadingRow(props.node.row)}
  {/if}
{:else if props.node.kind === 'terminal'}
  <FeedSurfaceStatus phase="end" />
{:else if props.node.kind === 'loadingOlder'}
  <FeedSurfaceStatus phase="loadingOlder" />
{:else if props.node.kind === 'empty'}
  <p class="event-list__empty">{props.node.text}</p>
{:else if collapsed}
  {#if canOpenThread}
    <button
      type="button"
      class="thread-continuation"
      style={`--event-depth: ${collapsed.depth}`}
      onclick={() => props.openThread?.(collapsed.targetId)}
    >
      Continue thread ({collapsed.hiddenCount})
    </button>
  {:else}
    <p class="thread-continuation" style={`--event-depth: ${collapsed.depth}`}>
      {collapsed.hiddenCount} hidden thread item(s) unavailable.
    </p>
  {/if}
{:else if props.node.kind === 'eventFragment'}
  <EventFragmentRow
    node={props.node.node}
    fragment={props.node.fragment}
    profile={props.profiles?.[props.node.node.event.pubkey]}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    liked={actionStateForEvent(props.actionStates, props.node.node.event.id)
      .liked}
    reposted={actionStateForEvent(props.actionStates, props.node.node.event.id)
      .reposted}
    reactions={props.reactions?.[props.node.node.event.id]}
    reposts={props.reposts?.[props.node.node.event.id]}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
{:else if eventNode && 'event' in eventNode}
  <EventRow
    item={eventNode}
    depth={eventNode.depth}
    profile={props.profiles?.[eventNode.event.pubkey]}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    liked={actionStateForEvent(props.actionStates, eventNode.event.id).liked}
    reposted={actionStateForEvent(props.actionStates, eventNode.event.id)
      .reposted}
    reactions={props.reactions?.[eventNode.event.id]}
    reposts={props.reposts?.[eventNode.event.id]}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
{/if}
