<script lang="ts">
  import FormTabShell from '$lib/components/workspace/FormTabShell.svelte';
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
  import { sqliteListAppLog } from '$lib/storage/sqlite-opfs/app-log-repository';
  import JobTreeLog from './JobTreeLog.svelte';

  let snapshots = $state<RelaySnapshot[]>([]);
  let durableLogs = $state<readonly AppLogRecord[]>([]);
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
    uniqueChronological([...durableLogs, ...sessionLogs, ...relayLogs]),
  );

  onMount(() => {
    void sqliteListAppLog(300)
      .then((records) => {
        durableLogs = records;
      })
      .catch(() => undefined);
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

  function uniqueChronological(
    records: readonly AppLogRecord[],
  ): AppLogRecord[] {
    const byId = new Map(records.map((record) => [record.id, record]));
    return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
  }
</script>

<FormTabShell label="lkjstr Log" class="relay-monitor">
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
</FormTabShell>
