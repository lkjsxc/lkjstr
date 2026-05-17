<script lang="ts">
  import type { RelaySet } from '$lib/relays/relay-store';

  type Props = {
    relaySets: RelaySet[];
    toggleRelay: (setId: string, url: string, enabled: boolean) => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
</script>

<section class="relay-monitor">
  <h2>Relays</h2>
  {#each props.relaySets as set (set.id)}
    <article class="relay-set">
      <h3>{set.name}</h3>
      {#each set.relays as relay (relay.url)}
        <div class="row">
          <span>
            <strong>{relay.label}</strong>
            <small>{relay.url}</small>
          </span>
          <span>{relay.state}</span>
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
        </div>
      {/each}
    </article>
  {:else}
    <p>No relay sets configured.</p>
  {/each}
</section>
