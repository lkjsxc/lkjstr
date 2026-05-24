<script lang="ts">
  import { onMount } from 'svelte';
  import {
    appLogRecords,
    subscribeAppLog,
    type AppLogRecord,
  } from '$lib/log/app-log';
  import { relayDiagnosticDisplayMessage } from '$lib/relays/relay-diagnostic-display';
  import {
    flattenRelayDiagnostics,
    startRelaySnapshotPolling,
  } from '$lib/relays/session-snapshots';
  import type { RelaySnapshot } from '$lib/relays/types';
  import JobTreeLog from './JobTreeLog.svelte';

  let snapshots = $state<RelaySnapshot[]>([]);
  let sessionLogs = $state<readonly AppLogRecord[]>(appLogRecords());
  let relayLogs = $derived(
    flattenRelayDiagnostics(snapshots).map((item, index) => ({
      id: `${item.timestamp}:${item.relay}:${item.kind}:${index}`,
      timestamp: item.timestamp,
      area: 'relay',
      severity: item.kind === 'notice' ? 'info' : 'warn',
      code: item.kind,
      message: item.message,
      context: { relay: item.relay, subId: item.subId },
    })) satisfies readonly AppLogRecord[],
  );
  let logs = $derived(
    [...sessionLogs, ...relayLogs].sort((a, b) => a.timestamp - b.timestamp),
  );

  onMount(() => {
    const stopLog = subscribeAppLog((records) => (sessionLogs = records));
    const stopSnapshots = startRelaySnapshotPolling((next) => {
      snapshots = next;
    });
    return () => {
      stopLog();
      stopSnapshots();
    };
  });

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  function contextText(record: AppLogRecord): string {
    return record.context ? JSON.stringify(record.context) : '';
  }
</script>

<section class="relay-monitor" aria-label="lkjstr Log">
  <JobTreeLog />
  {#each logs as item (item.id)}
    <article class="relay-log-row">
      <strong>{item.area}</strong>
      <time datetime={new Date(item.timestamp).toISOString()}>
        {formatTimestamp(item.timestamp)}
      </time>
      <small>{item.severity}</small>
      <small>{item.code}</small>
      <p>{relayDiagnosticDisplayMessage(item.message)}</p>
      {#if contextText(item)}
        <small>{contextText(item)}</small>
      {/if}
    </article>
  {:else}
    <p>No diagnostics recorded this session.</p>
  {/each}
</section>
