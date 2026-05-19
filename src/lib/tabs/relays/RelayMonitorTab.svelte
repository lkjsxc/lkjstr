<script lang="ts">
  import { normalizeRelayUrl } from '../../protocol';
  import type { RelaySet } from '../../relays/relay-store';
  import type { RelaySnapshot } from '../../relays/types';

  type Props = {
    relaySets: RelaySet[];
    snapshots?: RelaySnapshot[];
  };

  let props: Props = $props();
  let snapshotByUrl = $derived(
    new Map(
      (props.snapshots ?? []).map((snapshot) => [snapshot.url, snapshot]),
    ),
  );

  function formatTimestamp(timestamp?: number): string {
    if (!timestamp) return 'never';
    return new Date(timestamp).toLocaleString();
  }
</script>

<section class="relay-monitor">
  <h2>Relay Logs</h2>
  {#each props.relaySets as set (set.id)}
    <article class="relay-set">
      <h3>{set.name}</h3>
      {#each set.relays as relay (relay.url)}
        {@const snapshot = snapshotByUrl.get(
          normalizeRelayUrl(relay.url) ?? '',
        )}
        <div class="row">
          <span>
            <strong>{relay.label}</strong>
            <small>{relay.url}</small>
          </span>
          <span>{snapshot?.state ?? relay.state}</span>
          <small>Last message: {formatTimestamp(snapshot?.lastMessageAt)}</small
          >
          {#if snapshot?.lastError}
            <small>Last error: {snapshot.lastError}</small>
          {/if}
          {#if snapshot?.diagnostics.length}
            <ul aria-label={`Diagnostics ${relay.url}`}>
              {#each snapshot.diagnostics as item, index (`${item.timestamp}:${item.kind}:${item.subId ?? ''}:${item.message}:${index}`)}
                <li>
                  <strong>{item.kind}</strong>
                  <span>{item.message}</span>
                  <small>{item.relay}</small>
                  {#if item.subId}
                    <small>subId: {item.subId}</small>
                  {/if}
                  <time datetime={new Date(item.timestamp).toISOString()}>
                    {formatTimestamp(item.timestamp)}
                  </time>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/each}
    </article>
  {:else}
    <p>No relay sets configured.</p>
  {/each}
</section>
