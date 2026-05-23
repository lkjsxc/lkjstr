<script lang="ts">
  import { onMount } from 'svelte';
  import {
    runtimeCounterSnapshots,
    setRuntimeCountersEnabled,
    type RuntimeCounterSnapshot,
  } from '$lib/app/runtime-counters';
  import { loadSettings } from '$lib/settings/settings-store';

  let enabled = $state(false);
  let counters = $state<RuntimeCounterSnapshot[]>([]);

  onMount(() => void refresh());

  async function refresh(): Promise<void> {
    enabled =
      (await loadSettings()).find(
        (setting) => setting.key === 'debug.showRuntimeCounters',
      )?.value === true;
    setRuntimeCountersEnabled(enabled);
    counters = runtimeCounterSnapshots();
  }
</script>

{#if enabled}
  <h3>Runtime counters</h3>
  <button type="button" onclick={() => void refresh()}>Refresh counters</button>
  <table class="stats-table">
    <thead>
      <tr>
        <th>Key</th><th>Active</th><th>Created</th><th>Closed</th>
        <th>Events</th><th>Reads</th>
      </tr>
    </thead>
    <tbody>
      {#each counters as item (item.key)}
        <tr>
          <td>{item.key}</td>
          <td>{item.active}</td>
          <td>{item.created}</td>
          <td>{item.closed}</td>
          <td>{item.events}</td>
          <td>{item.pageReads}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
