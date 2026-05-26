<script lang="ts">
  import type { FeedPagingPhase } from '$lib/feed-surface/paging-state';

  type Props = {
    phase?: FeedPagingPhase;
    loadingOlder?: boolean;
    endOfHistory?: boolean;
    error?: string;
  };

  let props: Props = $props();
  let showLoading = $derived(
    props.phase === 'loadingOlder' || props.loadingOlder,
  );
  let showEnd = $derived(props.phase === 'end' || props.endOfHistory);
  let showError = $derived(props.phase === 'error' ? props.error : props.error);
</script>

{#if showError}
  <p class="event-list__status" role="alert">{showError}</p>
{:else if showLoading}
  <p class="event-list__status" aria-busy="true">Loading older events...</p>
{:else if showEnd}
  <p class="event-list__status">End of known history.</p>
{/if}
