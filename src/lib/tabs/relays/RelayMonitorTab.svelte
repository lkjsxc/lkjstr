<script lang="ts">
  import { sharedRelayPool } from '$lib/relays/relay-pool';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { RelaySnapshot } from '$lib/relays/types';

  type Props = {
    relaySets: RelaySet[];
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
  let snapshots = $state<RelaySnapshot[]>([]);

  $effect(() => sharedRelayPool.onState((next) => (snapshots = next)));

  function snapshotFor(url: string): RelaySnapshot | undefined {
    return snapshots.find((snapshot) => snapshot.url === url);
  }
</script>

<section class="relay-monitor">
  <h2>Relays</h2>
  {#each props.relaySets as set (set.id)}
    <article class="relay-set">
      <h3>{set.name}</h3>
      {#each set.relays as relay (relay.url)}
        {@const snapshot = snapshotFor(relay.url)}
        <div class="row">
          <span>
            <strong>{relay.label}</strong>
            <small>{relay.url}</small>
          </span>
          <span>{snapshot?.state ?? relay.state}</span>
          <label>
            <input
              type="checkbox"
              checked={relay.enabled}
              onchange={(event) =>
                props.toggleRelay(
                  set.id,
                  relay.url,
                  event.currentTarget.checked,
                )}
            />
            enabled
          </label>
          <button
            type="button"
            onclick={() => props.removeRelay(set.id, relay.url)}
          >
            Remove
          </button>
          {#if snapshot?.diagnostics.length}
            <ul aria-label={`Diagnostics ${relay.url}`}>
              {#each snapshot.diagnostics as item (`${item.timestamp}:${item.message}`)}
                <li>{item.kind}: {item.message}</li>
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
