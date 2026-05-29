<script lang="ts">
  import type { CacheMetadata } from '$lib/cache/cache-status';

  type Props = {
    cache: CacheMetadata | null;
  };

  let props: Props = $props();

  function formatBytes(value: number | null | undefined): string {
    if (value === null || value === undefined) return 'unknown';
    const mib = 1024 * 1024;
    const gib = 1024 * mib;
    if (value >= gib) return `${(value / gib).toFixed(2)} GiB`;
    if (value >= mib) return `${Math.round(value / mib)} MiB`;
    return `${value} bytes`;
  }
</script>

<h3>Cache</h3>
{#if props.cache}
  <p>
    {props.cache.rawEventCount} events, {props.cache.profileCount} profiles,
    {props.cache.notificationCount} notifications
  </p>
  <table class="stats-table">
    <tbody>
      <tr><th>Budget</th><td>{formatBytes(props.cache.budgetBytes)}</td></tr>
      <tr>
        <th>Event cache</th><td>{formatBytes(props.cache.eventCacheBytes)}</td>
      </tr>
      <tr>
        <th>Browser usage</th>
        <td>{formatBytes(props.cache.browserUsageBytes)}</td>
      </tr>
      <tr>
        <th>Last enforcement</th>
        <td>{props.cache.lastCompactionReason ?? 'none'}</td>
      </tr>
      <tr><th>Pruned events</th><td>{props.cache.prunedEventCount}</td></tr>
      <tr>
        <th>Pruned bytes</th>
        <td>{formatBytes(props.cache.prunedByteEstimate)}</td>
      </tr>
      <tr>
        <th>Protected only</th>
        <td>{props.cache.protectedOnly ? 'yes' : 'no'}</td>
      </tr>
    </tbody>
  </table>
{/if}
