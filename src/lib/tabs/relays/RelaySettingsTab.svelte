<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import {
    listRelayDiagnosticSummaries,
    type RelayDiagnosticSummary,
  } from '$lib/relays/relay-diagnostic-summary';
  import {
    fetchRelayInformation,
    listRelayInformation,
    type RelayInformationRecord,
  } from '$lib/relays/relay-info';
  import {
    importRelayListSuggestion,
    relayListSuggestionsForAccount,
    type RelayListSuggestionRecord,
  } from '$lib/relays/relay-list-suggestions';
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
  import RelayInfoDetails from './RelayInfoDetails.svelte';
  import RelaySuggestionList from './RelaySuggestionList.svelte';

  type Props = {
    relaySets: RelaySet[];
    activeAccount?: Account;
    refresh: () => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
  let input = $state('');
  let error = $state('');
  let defaultSetId = $state(selectedDefaultRelaySetId());
  let snapshots = $state<RelaySnapshot[]>([]);
  let information = $state<Record<string, RelayInformationRecord>>({});
  let summaries = $state<Record<string, RelayDiagnosticSummary>>({});
  let suggestions = $state<RelayListSuggestionRecord[]>([]);

  onMount(() => void refreshLocal());

  $effect(() => {
    const pubkey = props.activeAccount?.pubkey;
    void refreshSuggestions(pubkey);
  });

  async function add(setId: string): Promise<void> {
    try {
      await addRelay(setId, input);
      input = '';
      props.refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Relay add failed.';
    }
  }

  // prettier-ignore
  async function patch(setId: string, url: string, key: string, value: unknown) { await updateRelay(setId, url, { [key]: value }); props.refresh(); }
  // prettier-ignore
  async function restore(): Promise<void> { await restoreDefaultRelaySet(); props.refresh(); }
  // prettier-ignore
  function makeDefault(setId: string): void { setDefaultRelaySetId(setId); defaultSetId = setId; props.refresh(); }
  // prettier-ignore
  function snapshot(url: string): RelaySnapshot | undefined { return snapshots.find((item) => item.url === url); }

  async function refreshLocal(): Promise<void> {
    const [infoRows, summaryRows] = await Promise.all([
      listRelayInformation(),
      listRelayDiagnosticSummaries(),
    ]);
    information = Object.fromEntries(
      infoRows.map((item) => [item.relayUrl, item]),
    );
    summaries = Object.fromEntries(
      summaryRows.map((item) => [item.relayUrl, item]),
    );
    await refreshSuggestions(props.activeAccount?.pubkey);
  }

  async function refreshSuggestions(pubkey?: string): Promise<void> {
    suggestions = pubkey ? await relayListSuggestionsForAccount(pubkey) : [];
  }

  // prettier-ignore
  async function fetchInfo(url: string): Promise<void> { information = { ...information, [url]: await fetchRelayInformation(url) }; }

  async function importSuggestion(
    setId: string,
    suggestion: RelayListSuggestionRecord,
  ): Promise<void> {
    await importRelayListSuggestion(setId, suggestion);
    await props.refresh();
  }

  // prettier-ignore
  function formatTime(timestamp?: number): string { return timestamp ? new Date(timestamp).toLocaleString() : 'never'; }

  $effect(() => sharedRelayPool.onState((next) => (snapshots = next)));
</script>

<section class="relay-settings" aria-label="Relay Settings">
  {#if error}<p role="alert">{error}</p>{/if}
  {#each props.relaySets as set (set.id)}
    <article class="relay-set">
      <h3>{set.name}{defaultSetId === set.id ? ' default' : ''}</h3>
      <div class="toolbar">
        <input
          aria-label="Relay URL"
          bind:value={input}
          id={`relay-url-${set.id}`}
          name={`relay-url-${set.id}`}
        />
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
            id={`relay-label-${set.id}-${relay.url}`}
            name={`relay-label-${set.id}-${relay.url}`}
            value={relay.label}
            onblur={(event) =>
              patch(set.id, relay.url, 'label', event.currentTarget.value)}
          />
          <small>{relay.url}</small>
          {#each ['enabled', 'read', 'write'] as key (key)}
            <label>
              <input
                checked={Boolean(relay[key as 'enabled'])}
                id={`relay-${key}-${set.id}-${relay.url}`}
                name={`relay-${key}-${set.id}-${relay.url}`}
                type="checkbox"
                onchange={(event) =>
                  patch(set.id, relay.url, key, event.currentTarget.checked)}
              />
              {key}
            </label>
          {/each}
          <small>{snapshot(relay.url)?.state ?? relay.state}</small>
          <RelayInfoDetails record={information[relay.url]} />
          <small>
            {relay.health.attempts} attempts · {relay.health.successes} ok ·
            {relay.health.failures} failed
          </small>
          {#if summaries[relay.url]}
            <small>
              persisted events {summaries[relay.url].validEventCount} · last
              {summaries[relay.url].lastEventId ?? 'none'}
            </small>
          {/if}
          <small>last connected {formatTime(relay.lastConnectedAt)}</small>
          {#if snapshot(relay.url)?.lastError}
            <small>{snapshot(relay.url)?.lastError}</small>
          {:else if relay.lastError}
            <small>{relay.lastError}</small>
          {/if}
          <button
            type="button"
            onclick={() => props.removeRelay(set.id, relay.url)}
          >
            Remove
          </button>
          <button type="button" onclick={() => void fetchInfo(relay.url)}>
            Fetch info
          </button>
        </div>
      {/each}
      <RelaySuggestionList
        {set}
        {suggestions}
        importSuggestion={(setId, suggestion) =>
          void importSuggestion(setId, suggestion)}
      />
    </article>
  {:else}
    <p>No relay sets are configured.</p>
  {/each}
</section>
