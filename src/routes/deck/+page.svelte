<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { connectNip07 } from '$lib/accounts/nip07';
  import { parseReadonlyAccount, type Account } from '$lib/accounts/account';
  import {
    addRelay,
    addTile,
    moveTile,
    removeRelay,
    removeTile,
    resizeTile,
  } from '$lib/deck/actions';
  import { loadSettings, saveSettings } from '$lib/deck/persistence';
  import type { AppSettings, TileType } from '$lib/deck/types';
  import { EventStore } from '$lib/cache/event-store';
  import { mergeTimeline } from '$lib/query/timeline';
  import { normalizeRelayUrl, unixNow, type NostrEvent } from '$lib/protocol';
  import { RelayPool, type PublishResult } from '$lib/relays/relay-pool';
  import DeckTile from '$lib/components/deck/DeckTile.svelte';

  let settings = $state<AppSettings>();
  let account = $state<Account>();
  let readonlyInput = $state('');
  let relayInput = $state('');
  let composeText = $state('');
  let events = $state<NostrEvent[]>([]);
  let relayStates = $state<ReturnType<RelayPool['snapshots']>>([]);
  let publishResults = $state<PublishResult[]>([]);
  let status = $state('Relays are user configured.');

  const store = new EventStore();
  const pool = new RelayPool();
  const unsubscribers: (() => void)[] = [];

  $effect(() => {
    if (settings) saveSettings(settings);
  });

  onMount(() => {
    settings = loadSettings();
    unsubscribers.push(pool.onEvent(({ event }) => receiveEvent(event)));
    unsubscribers.push(pool.onState((states) => (relayStates = states)));
    resubscribe();
  });

  onDestroy(() => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    pool.close();
  });

  function receiveEvent(event: NostrEvent): void {
    store.upsert(event);
    events = mergeTimeline(store.list(), [], [{ kinds: [1] }], 200);
  }

  function readableRelays(): string[] {
    return (
      settings?.relays
        .filter((relay) => relay.read)
        .map((relay) => relay.url) ?? []
    );
  }

  function writableRelays(): string[] {
    return (
      settings?.relays
        .filter((relay) => relay.write)
        .map((relay) => relay.url) ?? []
    );
  }

  function resubscribe(): void {
    const relays = readableRelays();
    if (relays.length === 0) return;
    pool.subscribe(relays, 'timeline', [{ kinds: [1], limit: 50 }]);
    status = `Subscribed to ${relays.length} relay${relays.length === 1 ? '' : 's'}.`;
  }

  function addRelayFromInput(): void {
    const url = normalizeRelayUrl(relayInput);
    if (!url || !settings) {
      status = 'Relay URL is invalid.';
      return;
    }
    settings = addRelay(settings, { url, read: true, write: true });
    relayInput = '';
    resubscribe();
  }

  function removeRelayUrl(url: string): void {
    if (!settings) return;
    settings = removeRelay(settings, url);
    status = 'Relay removed. Refresh subscriptions with the remaining relays.';
  }

  function addTileType(type: TileType): void {
    if (!settings) return;
    settings = { ...settings, activeDeck: addTile(settings.activeDeck, type) };
  }

  function move(id: string, direction: -1 | 1): void {
    if (!settings) return;
    settings = {
      ...settings,
      activeDeck: moveTile(settings.activeDeck, id, direction),
    };
  }

  function remove(id: string): void {
    if (!settings) return;
    settings = { ...settings, activeDeck: removeTile(settings.activeDeck, id) };
  }

  function resize(id: string, delta: number): void {
    if (!settings) return;
    settings = {
      ...settings,
      activeDeck: resizeTile(settings.activeDeck, id, delta),
    };
  }

  async function useNip07(): Promise<void> {
    account = await connectNip07();
    status = account
      ? `Connected ${account.label}.`
      : 'NIP-07 signer is unavailable.';
  }

  function useReadonly(): void {
    account = parseReadonlyAccount(readonlyInput);
    status = account
      ? `Using read-only ${account.label}.`
      : 'Read-only account input is invalid.';
  }

  async function publishNote(): Promise<void> {
    if (account?.mode !== 'nip07' || !window.nostr) {
      status = 'Connect NIP-07 before publishing.';
      return;
    }
    const relays = writableRelays();
    if (relays.length === 0) {
      status = 'Add a writable relay before publishing.';
      return;
    }
    const signed = await window.nostr.signEvent({
      pubkey: account.pubkey,
      created_at: unixNow(),
      kind: 1,
      tags: [],
      content: composeText,
    });
    publishResults = await pool.publish(relays, signed);
    composeText = publishResults.some((result) => result.accepted)
      ? ''
      : composeText;
  }
</script>

{#if settings}
  <main class="deck-shell">
    <aside class="rail">
      <strong>lkjstr</strong>
      <span>{status}</span>
      <input bind:value={relayInput} placeholder="wss://relay.example" />
      <button type="button" onclick={addRelayFromInput}>Add relay</button>
      <input bind:value={readonlyInput} placeholder="npub or hex pubkey" />
      <button type="button" onclick={useReadonly}>Read-only</button>
      <button type="button" onclick={useNip07}>NIP-07</button>
      <button type="button" onclick={() => addTileType('timeline')}
        >Timeline tile</button
      >
      <button type="button" onclick={() => addTileType('relay-monitor')}
        >Relay tile</button
      >
      <button type="button" onclick={() => addTileType('composer')}
        >Composer tile</button
      >
    </aside>

    <section class="deck" aria-label="Active deck">
      {#each [...settings.activeDeck.tiles].sort((a, b) => a.order - b.order) as tile (tile.id)}
        <DeckTile
          {tile}
          {events}
          {settings}
          {relayStates}
          {publishResults}
          bind:composeText
          {move}
          {resize}
          {remove}
          {removeRelayUrl}
          {publishNote}
        />
      {/each}
    </section>
  </main>
{/if}
