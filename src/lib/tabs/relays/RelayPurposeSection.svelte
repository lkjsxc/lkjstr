<script lang="ts">
  import type { RelayDiagnosticSummary } from '$lib/relays/relay-diagnostic-summary';
  import type { RelayInformationRecord } from '$lib/relays/relay-info';
  import type { RelayListSuggestionRecord } from '$lib/relays/relay-list-suggestions';
  import type { RelayPurpose } from '$lib/relays/relay-purpose';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { RelaySnapshot } from '$lib/relays/types';
  import RelayRow from './RelayRow.svelte';
  import RelaySuggestionList from './RelaySuggestionList.svelte';

  type PatchKey = 'label' | 'enabled' | 'read' | 'write';

  type Props = {
    title: string;
    purpose: RelayPurpose;
    sets: RelaySet[];
    defaultSetId: string;
    suggestions?: RelayListSuggestionRecord[];
    snapshots: RelaySnapshot[];
    information: Record<string, RelayInformationRecord>;
    summaries: Record<string, RelayDiagnosticSummary>;
    addRelay: (setId: string, input: string) => Promise<void>;
    patch: (
      setId: string,
      url: string,
      key: PatchKey,
      value: unknown,
    ) => void | Promise<void>;
    restore: (purpose: RelayPurpose) => void | Promise<void>;
    makeDefault: (setId: string) => void;
    removeRelay: (setId: string, url: string) => void;
    fetchInfo: (url: string) => void;
    importSuggestion: (
      setId: string,
      suggestion: RelayListSuggestionRecord,
    ) => void;
  };

  let props: Props = $props();
  let input = $state('');

  function snapshot(url: string): RelaySnapshot | undefined {
    return props.snapshots.find((item) => item.url === url);
  }

  async function add(setId: string): Promise<void> {
    await props.addRelay(setId, input);
    input = '';
  }
</script>

<section class="relay-purpose" aria-label={props.title}>
  <h2>{props.title}</h2>
  {#each props.sets as set (set.id)}
    <article class="relay-set">
      <h3>{set.name}{props.defaultSetId === set.id ? ' default' : ''}</h3>
      <div class="toolbar">
        <input
          aria-label={`${props.title} relay URL`}
          bind:value={input}
          id={`relay-url-${set.id}`}
          name={`relay-url-${set.id}`}
        />
        <button type="button" onclick={() => void add(set.id)}>
          Add relay
        </button>
        {#if props.purpose === 'user'}
          <button type="button" onclick={() => props.makeDefault(set.id)}>
            Use as default
          </button>
        {/if}
        <button type="button" onclick={() => props.restore(props.purpose)}>
          Restore defaults
        </button>
      </div>
      {#each set.relays as relay (relay.url)}
        <RelayRow
          setId={set.id}
          purpose={props.purpose}
          {relay}
          snapshot={snapshot(relay.url)}
          information={props.information[relay.url]}
          summary={props.summaries[relay.url]}
          patch={props.patch}
          removeRelay={props.removeRelay}
          fetchInfo={props.fetchInfo}
        />
      {/each}
      {#if props.purpose === 'user'}
        <RelaySuggestionList
          {set}
          suggestions={props.suggestions ?? []}
          importSuggestion={props.importSuggestion}
        />
      {/if}
    </article>
  {:else}
    <p>No {props.title.toLowerCase()} are configured.</p>
  {/each}
</section>
