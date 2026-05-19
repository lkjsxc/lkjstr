<script lang="ts">
  import { flattenRelayDiagnostics } from '../../relays/session-snapshots';
  import type { RelaySnapshot } from '../../relays/types';

  type Props = {
    snapshots?: RelaySnapshot[];
  };

  let props: Props = $props();
  let diagnostics = $derived(flattenRelayDiagnostics(props.snapshots ?? []));

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return 'never';
    return new Date(timestamp).toLocaleString();
  }
</script>

<section class="relay-monitor">
  <h2>Relay Logs</h2>
  {#each diagnostics as item, index (`${item.timestamp}:${item.relay}:${item.kind}:${index}`)}
    <article class="relay-log-row">
      <strong>{item.kind}</strong>
      <time datetime={new Date(item.timestamp).toISOString()}>
        {formatTimestamp(item.timestamp)}
      </time>
      <small>{item.relay}</small>
      {#if item.subId}
        <small>subId: {item.subId}</small>
      {/if}
      <p>{item.message}</p>
    </article>
  {:else}
    <p>No relay diagnostics recorded this session.</p>
  {/each}
</section>
