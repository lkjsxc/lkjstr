<script lang="ts">
  type Props = {
    loadingOlder?: boolean;
    endOfHistory?: boolean;
    error?: string;
  };

  let { loadingOlder = false, endOfHistory = false, error }: Props = $props();
</script>

{#if error}
  <p class="event-list__status">{error}</p>
{:else if loadingOlder}
  <p class="event-list__status">Loading older events...</p>
{:else if endOfHistory}
  <p class="event-list__status">End of known history.</p>
{/if}
