<script lang="ts">
  import FeedScrollSurface from '$lib/components/feed/FeedScrollSurface.svelte';
  import type { FeedScrollListHandle } from '$lib/components/feed/FeedScrollSurface.svelte';
  import type { OlderLoadTrigger } from '$lib/feed-surface/older-load-mode';
  import type { FeedPagingPhase } from '$lib/feed-surface/footer-phase';
  import type { EventActionState } from '$lib/events/action-state';
  import EventTreeListRows from './EventTreeListRows.svelte';
  import type { EventTreeListProps } from './event-tree-list-props';
  import type { EventTreeListViewRow } from './event-tree-list-helpers';
  import { viewRowKey } from './event-tree-list-helpers';

  type Props = {
    props: EventTreeListProps;
    rows: readonly EventTreeListViewRow[];
    phase: FeedPagingPhase;
    nearEndEnabled: boolean;
    actionStates: Map<string, EventActionState>;
    requestOlder: (trigger: OlderLoadTrigger) => void | Promise<void>;
    handleScrollOffset: (offset: number) => void;
    list?: FeedScrollListHandle;
    scrollElement?: HTMLElement;
  };

  let {
    props,
    rows,
    phase,
    nearEndEnabled,
    actionStates,
    requestOlder,
    handleScrollOffset,
    list = $bindable(),
    scrollElement = $bindable(),
  }: Props = $props();
</script>

<FeedScrollSurface
  data={rows}
  getKey={(item: unknown) => viewRowKey(item as EventTreeListViewRow)}
  scrollerClass="event-list__scroller"
  viewportClass="event-list__viewport"
  {nearEndEnabled}
  onNearEnd={requestOlder}
  onScrollOffset={handleScrollOffset}
  intentKey={props.intentKey}
  bind:list
  bind:scrollElement
>
  {#snippet row(node: unknown)}
    <EventTreeListRows
      node={node as EventTreeListViewRow}
      {phase}
      profiles={props.profiles}
      relaySets={props.relaySets}
      activeAccountPubkey={props.activeAccountPubkey}
      reactions={props.reactions}
      reposts={props.reposts}
      {actionStates}
      openProfile={props.openProfile}
      openThread={props.openThread}
      openAuthorContext={props.openAuthorContext}
      leadingRow={props.leadingRow}
    />
  {/snippet}
</FeedScrollSurface>
