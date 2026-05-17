<script lang="ts">
  import type { AppSettings, Tile } from '$lib/deck/types';
  import type { NostrEvent } from '$lib/protocol';
  import type { PublishResult } from '$lib/relays/relay-pool';
  import type { RelaySnapshot } from '$lib/relays/types';

  type Props = {
    tile: Tile;
    events: NostrEvent[];
    settings: AppSettings;
    relayStates: RelaySnapshot[];
    publishResults: PublishResult[];
    composeText: string;
    move: (id: string, direction: -1 | 1) => void;
    resize: (id: string, delta: number) => void;
    remove: (id: string) => void;
    removeRelayUrl: (url: string) => void;
    publishNote: () => Promise<void>;
  };

  let {
    tile,
    events,
    settings,
    relayStates,
    publishResults,
    composeText = $bindable(),
    move,
    resize,
    remove,
    removeRelayUrl,
    publishNote,
  }: Props = $props();
</script>

<article class="tile" style={`flex-basis: ${tile.width}px`}>
  <header>
    <h2>{tile.title}</h2>
    <nav aria-label={`${tile.title} actions`}>
      <button type="button" onclick={() => move(tile.id, -1)}>←</button>
      <button type="button" onclick={() => move(tile.id, 1)}>→</button>
      <button type="button" onclick={() => resize(tile.id, -60)}>-</button>
      <button type="button" onclick={() => resize(tile.id, 60)}>+</button>
      <button type="button" onclick={() => remove(tile.id)}>×</button>
    </nav>
  </header>

  {#if tile.type === 'timeline' || tile.type === 'custom-filter'}
    <div class="timeline">
      {#each events as event (event.id)}
        <article class="event">
          <strong>{event.pubkey.slice(0, 12)}</strong>
          <time>{new Date(event.created_at * 1000).toLocaleString()}</time>
          <p>{event.content}</p>
        </article>
      {:else}
        <p>Add a relay to receive kind 1 notes.</p>
      {/each}
    </div>
  {:else if tile.type === 'relay-monitor'}
    <ul class="monitor">
      {#each settings.relays as relay (relay.url)}
        <li>
          <span>{relay.url}</span>
          <button type="button" onclick={() => removeRelayUrl(relay.url)}
            >Remove</button
          >
        </li>
      {/each}
      {#each relayStates as state (state.url)}
        <li>{state.url}: {state.state}</li>
      {/each}
    </ul>
  {:else}
    <textarea bind:value={composeText} placeholder="Write a note"></textarea>
    <button type="button" onclick={publishNote}>Publish</button>
    {#each publishResults as result (result.relay)}
      <p>{result.relay}: {result.accepted ? 'accepted' : result.message}</p>
    {/each}
  {/if}
</article>
