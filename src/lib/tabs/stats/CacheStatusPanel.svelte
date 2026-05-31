<script lang="ts">
  import type { CacheMetadata } from '$lib/cache/cache-status';
  import {
    cacheCountRows,
    cacheSummaryRows,
    formatBytes,
  } from './cache-status-panel-rows';

  type Props = {
    cache: CacheMetadata | null;
  };

  let props: Props = $props();
</script>

<h3>Cache</h3>
{#if props.cache}
  <p>
    {props.cache.rawEventCount} events, {props.cache.profileCount} profiles,
    {props.cache.notificationCount} notifications
  </p>
  <table class="stats-table">
    <tbody>
      {#each cacheSummaryRows(props.cache) as row (row.label)}
        <tr><th>{row.label}</th><td>{row.value}</td></tr>
      {/each}
      {#each cacheCountRows(props.cache) as row (row.label)}
        <tr><th>{row.label}</th><td>{row.value}</td></tr>
      {/each}
    </tbody>
  </table>

  <h4>Largest cache resource kinds</h4>
  <table class="stats-table">
    <thead>
      <tr>
        <th>Owner</th><th>Resource</th><th>Rows</th><th>Prunable</th><th
          >Protected</th
        ><th>Estimate</th>
      </tr>
    </thead>
    <tbody>
      {#each props.cache.ledgerInventory as row (`${row.ownerKind}:${row.resourceKind}`)}
        <tr>
          <td>{row.ownerKind}</td>
          <td>{row.resourceKind}</td>
          <td>{row.rowCount}</td>
          <td>{row.prunableRows}</td>
          <td>{row.protectedRows}</td>
          <td>{formatBytes(row.estimatedBytes)}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h4>Storage inventory</h4>
  <table class="stats-table">
    <thead>
      <tr>
        <th>Database</th><th>Store</th><th>Group</th><th>Scan</th><th>Rows</th
        ><th>Estimate</th>
      </tr>
    </thead>
    <tbody>
      {#each props.cache.storageInventory as row (`${row.database ?? ''}:${row.objectStore ?? row.table}`)}
        <tr>
          <td>{row.database ?? 'browser'}</td>
          <td>{row.objectStore ?? row.table}</td>
          <td>{row.group}</td>
          <td>{row.status}{row.reason ? `: ${row.reason}` : ''}</td>
          <td>{row.rowCount ?? 'n/a'}</td>
          <td>{formatBytes(row.estimatedBytes)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
