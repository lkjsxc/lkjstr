<script lang="ts">
  import type { SqliteStorageHealthStatus } from '$lib/storage/sqlite-opfs/storage-health';
  import type { StartupStorageDiagnostics } from '$lib/storage/sqlite-opfs/startup-diagnostics';

  type Props = {
    status: SqliteStorageHealthStatus | null;
    startup: StartupStorageDiagnostics;
  };

  let props: Props = $props();

  function value(label: string, text: unknown) {
    return { label, value: String(text ?? 'n/a') };
  }

  let rows = $derived(
    props.status?.status === 'available'
      ? [
          value('Mode', props.status.health.mode),
          value('VFS', props.status.health.vfsName),
          value('Worker', props.status.health.workerKind),
          value('SQLite', props.status.health.sqliteVersion),
          value('Database', props.status.health.databaseName),
          value('Pages', props.status.health.pageCount),
          value('Page size', props.status.health.pageSize),
          value('Freelist pages', props.status.health.freelistCount),
          value('Events', props.status.health.eventCount),
          value('Relay receipts', props.status.health.relayReceiptCount),
          value('Tag rows', props.status.health.tagRowCount),
          value(
            'Schema changes',
            props.status.health.appliedSchemaChanges.length,
          ),
        ]
      : [],
  );
</script>

<h3>SQLite Storage</h3>
{#if props.status?.status === 'available'}
  {#if props.status.health.mode === 'temporary-memory'}
    <p class="stats-warning">
      Temporary storage mode is active. Changes may disappear when this browser
      session ends.
    </p>
  {/if}
  <table class="stats-table">
    <tbody>
      {#each rows as row (row.label)}
        <tr><th>{row.label}</th><td>{row.value}</td></tr>
      {/each}
    </tbody>
  </table>
  {#if props.status.health.warnings.length > 0}
    <p>Warnings: {props.status.health.warnings.join(' | ')}</p>
  {/if}
{:else if props.status}
  <p>SQLite storage health unavailable: {props.status.message}</p>
{:else}
  <p>SQLite storage health has not been read yet.</p>
{/if}

<h4>Startup storage checks</h4>
{#if props.startup.updatedAt > 0}
  <table class="stats-table">
    <tbody>
      {#each props.startup.rows as row (row.key)}
        <tr>
          <th>{row.label}</th>
          <td>{row.status}</td>
          <td>{row.detail ?? row.reason}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{:else}
  <p>Startup storage diagnostics have not run yet.</p>
{/if}
