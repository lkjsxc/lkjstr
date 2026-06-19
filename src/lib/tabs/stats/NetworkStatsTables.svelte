<script lang="ts">
  import type { RelayDiagnosticSummary } from '$lib/relays/relay-diagnostic-summary';
  import type { RelaySnapshot } from '$lib/relays/types';
  import { stats } from './relay-totals';
  import { relaySubscriptionRows } from './subscription-rows';

  let props: {
    snapshots: RelaySnapshot[];
    summaries: RelayDiagnosticSummary[];
  } = $props();
  let subscriptionRows = $derived(relaySubscriptionRows(props.snapshots));
</script>

<table class="stats-table">
  <thead>
    <tr>
      {#each ['Relay', 'State', 'Events', 'OK', 'Bytes', 'Diagnostics'] as header (header)}
        <th>{header}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each props.snapshots as snapshot (snapshot.url)}
      <tr>
        <td>{snapshot.url}</td>
        <td>{snapshot.state}</td>
        <td>{stats(snapshot).eventCount}</td>
        <td
          >{stats(snapshot).okAcceptedCount}/{stats(snapshot)
            .okRejectedCount}</td
        >
        <td>{stats(snapshot).receivedBytes + stats(snapshot).sentBytes}</td>
        <td>{snapshot.diagnostics.at(-1)?.kind ?? 'none'}</td>
      </tr>
    {/each}
  </tbody>
</table>
<h3>Subscriptions</h3>
<table class="stats-table">
  <thead>
    <tr>
      <th>Purpose</th><th>Relay</th><th>Phase</th><th>Kind</th><th>Id</th>
    </tr>
  </thead>
  <tbody>
    {#each subscriptionRows as row (row.key)}
      <tr>
        <td>{row.label}</td>
        <td>{row.relay}</td>
        <td>{row.phase ?? '-'}</td>
        <td>{row.purpose ?? '-'}</td>
        <td><code>{row.shortId}</code></td>
      </tr>
    {/each}
  </tbody>
</table>
<h3>Persisted relay summaries</h3>
<table class="stats-table">
  <thead>
    <tr>
      {#each ['Relay', 'Attempts', 'Events', 'Last event', 'Latency'] as header (header)}
        <th>{header}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each props.summaries as summary (summary.relayUrl)}
      <tr>
        <td>{summary.relayUrl}</td>
        <td>{summary.attemptCount}/{summary.openCount}/{summary.errorCount}</td>
        <td
          >{summary.validEventCount} ok · {summary.invalidEventCount} invalid</td
        >
        <td>{summary.lastEventId ?? 'none'}</td>
        <td>
          {summary.firstMessageLatencyMs ?? '-'}ms first ·
          {summary.eoseLatencyMs ?? '-'}ms EOSE
        </td>
      </tr>
    {/each}
  </tbody>
</table>
