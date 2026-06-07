<script lang="ts">
  import FormTabShell from '$lib/components/workspace/FormTabShell.svelte';
  import type { TabKind } from '$lib/workspace/tab';
  import {
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
  let options = $derived(newTabOptionsForAccount(activeAccountPubkey));

  function choose(option: NewTabOption): void {
    convert(tabId, option.kind, option.config);
  }
</script>

<FormTabShell label="New Tab" class="new-tab">
  <div class="option-grid" aria-label="New Tab options">
    {#each options as option (option.label)}
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
</FormTabShell>
