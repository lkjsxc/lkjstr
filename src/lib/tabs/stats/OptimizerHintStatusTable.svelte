<script lang="ts">
  import { scanHintStatusRows } from '$lib/feed-surface/scan-hint-status';
  import type { ScanOptimizerDebugSnapshot } from '$lib/feed-surface/scan-model-debug';

  let props: { scanDebug: ScanOptimizerDebugSnapshot | null } = $props();
  let rows = $derived(
    scanHintStatusRows(props.scanDebug?.decisionTraces ?? []),
  );
</script>

<h4>Scan hint status</h4>
<table class="stats-table">
  <thead>
    <tr><th>Status</th><th>Recent decisions</th></tr>
  </thead>
  <tbody>
    {#if !props.scanDebug}
      <tr><td colspan="2">Loading scan hint status</td></tr>
    {:else if props.scanDebug.decisionTraces.length === 0}
      <tr><td colspan="2">No durable scan decision traces recorded yet</td></tr>
    {:else}
      {#each rows as row (row.status)}
        <tr>
          <td>{row.label}</td>
          <td>{row.count}</td>
        </tr>
      {/each}
    {/if}
  </tbody>
</table>
