<script lang="ts">
  import { VList } from 'virtua/svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { buildEventTree, flattenEventTree } from '$lib/events/tree';
  import type { FeedEvent } from '$lib/events/types';
  import EventRow from './EventRow.svelte';

  type Props = {
    items: readonly FeedEvent[];
    profiles?: Record<string, ProfileSummary>;
    loading?: boolean;
    emptyText?: string;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let nodes = $derived(flattenEventTree(buildEventTree(props.items)));
</script>

<div class="event-list">
  {#if nodes.length > 0}
    <VList
      data={nodes}
      style="height: 100%; min-height: 20rem;"
      getKey={(item) => item.event.id}
    >
      {#snippet children(node)}
        <EventRow
          item={node}
          depth={node.depth}
          profile={props.profiles?.[node.event.pubkey]}
          openProfile={props.openProfile}
          openThread={props.openThread}
        />
      {/snippet}
    </VList>
  {:else if !props.loading}
    <p>{props.emptyText ?? 'No events found.'}</p>
  {/if}
</div>
