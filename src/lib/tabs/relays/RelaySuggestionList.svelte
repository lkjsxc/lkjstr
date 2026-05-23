<script lang="ts">
  import type { RelayListSuggestionRecord } from '$lib/relays/relay-list-suggestions';
  import type { RelaySet } from '$lib/relays/relay-store';

  type Props = {
    set: RelaySet;
    suggestions: RelayListSuggestionRecord[];
    importSuggestion: (
      setId: string,
      suggestion: RelayListSuggestionRecord,
    ) => void;
  };

  let props: Props = $props();

  function alreadyConfigured(suggestion: RelayListSuggestionRecord): boolean {
    return props.set.relays.some((relay) => relay.url === suggestion.relayUrl);
  }
</script>

{#if props.suggestions.length > 0}
  <h4>NIP-65 suggestions</h4>
  {#each props.suggestions as suggestion (suggestion.id)}
    <div class="row">
      <small>{suggestion.relayUrl}</small>
      <small>
        {suggestion.read ? 'read' : ''}
        {suggestion.write ? 'write' : ''}
      </small>
      <button
        type="button"
        disabled={alreadyConfigured(suggestion)}
        onclick={() => props.importSuggestion(props.set.id, suggestion)}
      >
        Import
      </button>
    </div>
  {/each}
{/if}
