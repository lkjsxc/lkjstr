<script lang="ts">
  import type { TabKind } from '$lib/workspace/tab';
  import {
    filterNewTabOptions,
    newTabOptionsForAccount,
    type NewTabOption,
  } from './new-tab-options';

  type Props = {
    tabId: string;
    activeAccountPubkey?: string;
    convert: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
  };

  let { tabId, activeAccountPubkey, convert }: Props = $props();
  let query = $state('');
  let options = $derived(newTabOptionsForAccount(activeAccountPubkey));
  let filteredOptions = $derived(filterNewTabOptions(options, query));
  let primaryOptions = $derived(
    filteredOptions.filter((option) => option.group === 'primary'),
  );
  let secondaryOptions = $derived(
    filteredOptions.filter((option) => option.group === 'secondary'),
  );

  function choose(option: NewTabOption): void {
    convert(tabId, option.kind, option.config);
  }

  function clearFilter(): void {
    query = '';
  }

  function handleFilterKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    clearFilter();
    event.stopPropagation();
  }
</script>

<section class="new-tab" aria-label="New Tab">
  <div class="new-tab-filter-row">
    <label class="new-tab-filter-label" for={`new-tab-filter-${tabId}`}>
      Filter New Tab choices
    </label>
    <div class="new-tab-filter-controls">
      <input
        id={`new-tab-filter-${tabId}`}
        data-testid="new-tab-filter"
        type="search"
        bind:value={query}
        aria-label="Filter New Tab choices"
        placeholder="Search tabs"
        onkeydown={handleFilterKeydown}
      />
      {#if query.trim() !== ''}
        <button type="button" class="clear-filter" onclick={clearFilter}>
          Clear
        </button>
      {/if}
    </div>
    <p class="new-tab-result-count" aria-live="polite">
      {filteredOptions.length} {filteredOptions.length === 1 ? 'choice' : 'choices'}
    </p>
  </div>

  {#if primaryOptions.length > 0}
    <div class="option-group">
      <h2>Primary</h2>
      <div class="option-grid" aria-label="primary options">
        {#each primaryOptions as option (option.label)}
          <button
            type="button"
            class="option-card"
            data-testid={`new-tab-option-${option.kind}`}
            aria-label={option.label}
            onclick={() => choose(option)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if secondaryOptions.length > 0}
    <div class="option-group">
      <h2>Secondary</h2>
      <div class="option-grid" aria-label="secondary options">
        {#each secondaryOptions as option (option.label)}
          <button
            type="button"
            class="option-card"
            data-testid={`new-tab-option-${option.kind}`}
            aria-label={option.label}
            onclick={() => choose(option)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if filteredOptions.length === 0}
    <p class="new-tab-empty" role="status">No New Tab choices match this filter.</p>
  {/if}
</section>

<style>
  .new-tab-filter-row,
  .option-group {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }

  .new-tab-filter-label,
  .option-group h2,
  .new-tab-result-count,
  .new-tab-empty {
    margin: 0;
  }

  .new-tab-filter-controls {
    align-items: center;
    display: flex;
    gap: var(--space-2);
    min-width: 0;
  }

  .new-tab-filter-controls input {
    box-sizing: border-box;
    flex: 1 1 auto;
    min-width: 0;
    width: 100%;
  }

  .clear-filter {
    flex: 0 0 auto;
  }
</style>
