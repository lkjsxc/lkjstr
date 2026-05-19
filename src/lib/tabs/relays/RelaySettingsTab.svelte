<script lang="ts">
  import {
    addRelay,
    restoreDefaultRelaySet,
    selectedDefaultRelaySetId,
    setDefaultRelaySetId,
    updateRelay,
    type RelaySet,
  } from '$lib/relays/relay-store';
  import { sharedRelayPool } from '$lib/relays/relay-pool';
  import type { RelaySnapshot } from '$lib/relays/types';

  type Props = {
    relaySets: RelaySet[];
    refresh: () => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
  let input = $state('');
  let error = $state('');
  let defaultSetId = $state(selectedDefaultRelaySetId());
  let snapshots = $state<RelaySnapshot[]>([]);

  async function add(setId: string): Promise<void> {
    try {
      await addRelay(setId, input);
      input = '';
      props.refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Relay add failed.';
    }
  }

  async function patch(
    setId: string,
    url: string,
    key: string,
    value: unknown,
  ) {
    await updateRelay(setId, url, { [key]: value });
    props.refresh();
  }

  async function restore(): Promise<void> {
    await restoreDefaultRelaySet();
    props.refresh();
  }

  function makeDefault(setId: string): void {
    setDefaultRelaySetId(setId);
    defaultSetId = setId;
    props.refresh();
  }

  function snapshot(url: string): RelaySnapshot | undefined {
    return snapshots.find((item) => item.url === url);
  }

  $effect(() => sharedRelayPool.onState((next) => (snapshots = next)));
</script>

<section class="relay-settings">
  <h2>Relay Settings</h2>
  {#if error}<p role="alert">{error}</p>{/if}
  {#each props.relaySets as set (set.id)}
    <article class="relay-set">
      <h3>{set.name}{defaultSetId === set.id ? ' default' : ''}</h3>
      <div class="toolbar">
        <input aria-label="Relay URL" bind:value={input} />
        <button type="button" onclick={() => add(set.id)}>Add relay</button>
        <button type="button" onclick={() => makeDefault(set.id)}>
          Use as default
        </button>
        <button type="button" onclick={restore}>Restore defaults</button>
      </div>
      {#each set.relays as relay (relay.url)}
        <div class="row">
          <input
            aria-label={`Label ${relay.url}`}
            value={relay.label}
            onblur={(event) =>
              patch(set.id, relay.url, 'label', event.currentTarget.value)}
          />
          <small>{relay.url}</small>
          {#each ['enabled', 'read', 'write'] as key (key)}
            <label>
              <input
                type="checkbox"
                checked={Boolean(relay[key as 'enabled'])}
                onchange={(event) =>
                  patch(set.id, relay.url, key, event.currentTarget.checked)}
              />
              {key}
            </label>
          {/each}
          <small>{snapshot(relay.url)?.state ?? relay.state}</small>
          {#if snapshot(relay.url)?.lastError}
            <small>{snapshot(relay.url)?.lastError}</small>
          {/if}
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
    <p>No relay sets are configured.</p>
  {/each}
</section>
