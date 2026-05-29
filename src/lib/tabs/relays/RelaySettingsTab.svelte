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
  import type { RelayPurpose } from '$lib/relays/relay-purpose';
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
  import RelayPurposeSection from './RelayPurposeSection.svelte';

  type PatchKey = 'label' | 'enabled' | 'read' | 'write';

  type Props = {
    relaySets: RelaySet[];
    activeAccount?: Account;
    refresh: () => void;
    removeRelay: (setId: string, url: string) => void;
  };

  let props: Props = $props();
  let error = $state('');
  let defaultSetId = $state(selectedDefaultRelaySetId());
  let snapshots = $state<RelaySnapshot[]>([]);
  let information = $state<Record<string, RelayInformationRecord>>({});
  let summaries = $state<Record<string, RelayDiagnosticSummary>>({});
  let suggestions = $state<RelayListSuggestionRecord[]>([]);
  let userSets = $derived(
    props.relaySets.filter((set) => set.purpose === 'user'),
  );
  let discoverySets = $derived(
    props.relaySets.filter((set) => set.purpose === 'discovery'),
  );

  onMount(() => void refreshLocal());

  $effect(() => void refreshSuggestions(props.activeAccount?.pubkey));

  async function add(setId: string, input: string): Promise<void> {
    try {
      await addRelay(setId, input);
      error = '';
      props.refresh();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Relay add failed.';
    }
  }

  async function patch(
    setId: string,
    url: string,
    key: PatchKey,
    value: unknown,
  ): Promise<void> {
    await updateRelay(setId, url, { [key]: value });
    props.refresh();
  }

  async function restore(purpose: RelayPurpose): Promise<void> {
    await restoreDefaultRelaySet(purpose);
    props.refresh();
  }

  function makeDefault(setId: string): void {
    setDefaultRelaySetId(setId);
    defaultSetId = setId;
    props.refresh();
  }

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

  async function fetchInfo(url: string): Promise<void> {
    information = { ...information, [url]: await fetchRelayInformation(url) };
  }

  async function importSuggestion(
    setId: string,
    suggestion: RelayListSuggestionRecord,
  ): Promise<void> {
    await importRelayListSuggestion(setId, suggestion);
    props.refresh();
  }

  $effect(() => {
    const unsubscribe = sharedRelayPool.onState((next) => (snapshots = next));
    return unsubscribe;
  });
</script>

<section class="relay-settings" aria-label="Relay Settings">
  {#if error}<p role="alert">{error}</p>{/if}
  <RelayPurposeSection
    title="User relays"
    purpose="user"
    sets={userSets}
    {defaultSetId}
    {suggestions}
    {snapshots}
    {information}
    {summaries}
    addRelay={add}
    {patch}
    {restore}
    {makeDefault}
    removeRelay={props.removeRelay}
    fetchInfo={(url) => void fetchInfo(url)}
    importSuggestion={(setId, suggestion) =>
      void importSuggestion(setId, suggestion)}
  />
  <RelayPurposeSection
    title="Discovery relays"
    purpose="discovery"
    sets={discoverySets}
    {defaultSetId}
    {snapshots}
    {information}
    {summaries}
    addRelay={add}
    {patch}
    {restore}
    {makeDefault}
    removeRelay={props.removeRelay}
    fetchInfo={(url) => void fetchInfo(url)}
    importSuggestion={(setId, suggestion) =>
      void importSuggestion(setId, suggestion)}
  />
</section>
