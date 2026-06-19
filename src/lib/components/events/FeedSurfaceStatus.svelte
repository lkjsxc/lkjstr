<script lang="ts">
  import type { FeedPagingPhase } from '$lib/feed-surface/paging-state';
  import { planFeedSurfaceStatus } from './feed-surface-status-plan';

  type Props = {
    phase?: FeedPagingPhase;
    loadingOlder?: boolean;
    endOfHistory?: boolean;
    error?: string;
  };

  let props: Props = $props();
  let plan = $derived(
    planFeedSurfaceStatus({
      phase: props.phase,
      loadingOlder: props.loadingOlder,
      endOfHistory: props.endOfHistory,
      error: props.error,
    }),
  );
</script>

{#if plan.kind === 'error'}
  <p class="event-list__status" role={plan.role}>{plan.text}</p>
{:else if plan.kind === 'loading'}
  <p class="event-list__status" aria-busy={plan.ariaBusy}>{plan.text}</p>
{:else if plan.kind === 'end'}
  <p class="event-list__status">{plan.text}</p>
{/if}
