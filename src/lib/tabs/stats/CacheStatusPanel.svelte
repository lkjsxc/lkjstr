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
        <th>Prunable cache</th>
        <td>{formatBytes(props.cache.prunableCacheBytes)}</td>
      </tr>
      <tr>
        <th>Ledger bytes</th>
        <td>{formatBytes(props.cache.ledgerBytes)}</td>
      </tr>
      <tr>
        <th>Protected user data</th>
        <td>{formatBytes(props.cache.protectedUserBytes)}</td>
      </tr>
      <tr>
        <th>Unknown/browser overhead</th>
        <td>{formatBytes(props.cache.unknownOrOverheadBytes)}</td>
      </tr>
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
      <tr><th>Pruned resources</th><td>{props.cache.prunedResourceCount}</td></tr>
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
  <h4>Largest cache resource kinds</h4>
  <table class="stats-table">
    <thead>
      <tr><th>Owner</th><th>Resource</th><th>Rows</th><th>Estimate</th></tr>
    </thead>
    <tbody>
      {#each props.cache.ledgerInventory as row (`${row.ownerKind}:${row.resourceKind}`)}
        <tr>
          <td>{row.ownerKind}</td>
          <td>{row.resourceKind}</td>
          <td>{row.rowCount}</td>
          <td>{formatBytes(row.estimatedBytes)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <h4>Storage inventory</h4>
  <table class="stats-table">
    <thead>
      <tr><th>Store</th><th>Group</th><th>Rows</th><th>Estimate</th></tr>
    </thead>
    <tbody>
      {#each props.cache.storageInventory as row (row.table)}
        <tr>
          <td>{row.table}</td>
          <td>{row.group}</td>
          <td>{row.rowCount ?? 'n/a'}</td>
          <td>{formatBytes(row.estimatedBytes)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
