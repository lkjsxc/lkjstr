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
  import type {
    EventTreeListLeadingRow,
    EventTreeListViewRow,
  } from './event-tree-list-helpers';
  import {
    continuationPlanForViewRow,
    openContinuationThread,
  } from './event-tree-list-continuation-plan';
  import { eventTreeListRowData } from './event-tree-list-row-plan';

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
  let rowData = $derived(
    props.node.kind === 'event' || props.node.kind === 'eventFragment'
      ? eventTreeListRowData({
          node: props.node.node,
          profiles: props.profiles,
          reactions: props.reactions,
          reposts: props.reposts,
          actionStates: props.actionStates,
        })
      : undefined,
  );
  let continuation = $derived(
    continuationPlanForViewRow(props.node, props.openThread),
  );
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
{:else if continuation.visible}
  {#if continuation.canOpenThread}
    <button
      type="button"
      class="thread-continuation"
      style={`--event-depth: ${continuation.depth}`}
      onclick={() => openContinuationThread(continuation, props.openThread)}
    >
      {continuation.buttonText}
    </button>
  {:else}
    <p
      class="thread-continuation"
      style={`--event-depth: ${continuation.depth}`}
    >
      {continuation.unavailableText}
    </p>
  {/if}
{:else if props.node.kind === 'eventFragment'}
  <EventFragmentRow
    node={props.node.node}
    fragment={props.node.fragment}
    profile={rowData?.profile}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    liked={rowData?.liked ?? false}
    reposted={rowData?.reposted ?? false}
    reactions={rowData?.reactions}
    reposts={rowData?.reposts}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
{:else if eventNode && 'event' in eventNode}
  <EventRow
    item={eventNode}
    depth={eventNode.depth}
    profile={rowData?.profile}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    liked={rowData?.liked ?? false}
    reposted={rowData?.reposted ?? false}
    reactions={rowData?.reactions}
    reposts={rowData?.reposts}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
{/if}
