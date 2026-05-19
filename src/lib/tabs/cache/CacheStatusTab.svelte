<script lang="ts">
  import { onMount } from 'svelte';
  import { cacheStatus, type CacheMetadata } from '$lib/cache/cache-status';
  import { compactOldEvents } from '$lib/cache/compaction';

  let cache = $state<CacheMetadata | null>(null);
  let message = $state('');

  onMount(refresh);

  async function refresh(): Promise<void> {
    cache = await cacheStatus();
  }

  async function compact(): Promise<void> {
    const result = await compactOldEvents();
    message = result.skipped
      ? (result.reason ?? 'Compaction skipped.')
      : `${result.prunedEvents} old events removed.`;
    await refresh();
  }
</script>

<section class="data-tab">
  <h2>Cache</h2>
  {#if cache}
    <dl class="metric-list">
      <dt>Events</dt>
      <dd>{cache.rawEventCount}</dd>
      <dt>Profiles</dt>
      <dd>{cache.profileCount}</dd>
      <dt>Notifications</dt>
      <dd>{cache.notificationCount}</dd>
      <dt>Tweet drafts</dt>
      <dd>{cache.tweetDraftCount}</dd>
      <dt>Storage bytes</dt>
      <dd>{cache.storageEstimateBytes ?? 'unknown'}</dd>
    </dl>
  {:else}
    <p>Loading cache status...</p>
  {/if}
  <button type="button" onclick={compact}>Compact old events</button>
  {#if message}
    <p>{message}</p>
  {/if}
</section>
