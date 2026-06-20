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
  import {
    eventTreeListRowData,
    eventTreeListRowRenderPlan,
  } from './event-tree-list-row-plan';

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
  let render = $derived(
    eventTreeListRowRenderPlan({
      row: props.node,
      continuation,
    }),
  );
</script>

{#if render.kind === 'leading'}
  {#if props.leadingRow}
    {@render props.leadingRow(render.row.row)}
  {/if}
{:else if render.kind === 'terminal'}
  <FeedSurfaceStatus phase="end" />
{:else if render.kind === 'loadingOlder'}
  <FeedSurfaceStatus phase="loadingOlder" />
{:else if render.kind === 'empty'}
  <p class="event-list__empty">{render.row.text}</p>
{:else if render.kind === 'continuation'}
  {#if render.continuation.canOpenThread}
    <button
      type="button"
      class="thread-continuation"
      style={`--event-depth: ${render.continuation.depth}`}
      onclick={() =>
        openContinuationThread(render.continuation, props.openThread)}
    >
      {render.continuation.buttonText}
    </button>
  {:else}
    <p
      class="thread-continuation"
      style={`--event-depth: ${render.continuation.depth}`}
    >
      {render.continuation.unavailableText}
    </p>
  {/if}
{:else if render.kind === 'eventFragment'}
  <EventFragmentRow
    node={render.row.node}
    fragment={render.row.fragment}
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
{:else if render.kind === 'event'}
  <EventRow
    item={render.row.node}
    depth={render.row.node.depth}
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
