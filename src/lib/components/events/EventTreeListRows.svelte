<script lang="ts">
  import FeedSurfaceStatus from './FeedSurfaceStatus.svelte';
  import type { FeedPagingPhase } from '$lib/feed-surface/paging-state';
  import EventRow from './EventRow.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { FlatEventTreeItem } from '$lib/events/tree';
  import type {
    ReactionSummaryMap,
    RepostSummaryMap,
  } from '$lib/thread/thread-reactions';
  import type { EventActionState } from '$lib/events/action-state';
  import { actionStateForEvent } from '$lib/events/action-state';

  type TerminalRow = { readonly terminal: true };
  type LoadingRow = { readonly loadingOlder: true };
  export type ViewRow = FlatEventTreeItem | TerminalRow | LoadingRow;

  type Props = {
    node: ViewRow;
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
  };

  let props: Props = $props();
  let collapsed = $derived('collapsed' in props.node ? props.node : undefined);
</script>

{#if 'terminal' in props.node}
  <FeedSurfaceStatus phase="end" />
{:else if 'loadingOlder' in props.node}
  <FeedSurfaceStatus phase="loadingOlder" />
{:else if collapsed}
  <button
    type="button"
    class="thread-continuation"
    style={`--event-depth: ${collapsed.depth}`}
    onclick={() => props.openThread?.(collapsed.targetId)}
  >
    Continue thread ({collapsed.hiddenCount})
  </button>
{:else if 'event' in props.node}
  <EventRow
    item={props.node}
    depth={props.node.depth}
    profile={props.profiles?.[props.node.event.pubkey]}
    relaySets={props.relaySets}
    activeAccountPubkey={props.activeAccountPubkey}
    liked={actionStateForEvent(props.actionStates, props.node.event.id).liked}
    reposted={actionStateForEvent(props.actionStates, props.node.event.id)
      .reposted}
    reactions={props.reactions?.[props.node.event.id]}
    reposts={props.reposts?.[props.node.event.id]}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
    openAuthorContext={props.openAuthorContext}
  />
{/if}
