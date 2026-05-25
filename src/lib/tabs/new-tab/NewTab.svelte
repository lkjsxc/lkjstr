<script lang="ts">
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

<section class="new-tab" aria-label="New Tab">
  {#each ['primary', 'secondary'] as group (group)}
    <div class="option-grid" aria-label={`${group} options`}>
      {#each options.filter((option) => option.group === group) as option (option.label)}
        <button
          type="button"
          class="option-card"
          aria-label={option.label}
          onclick={() => choose(option)}
        >
          <strong>{option.label}</strong>
          <span>{option.description}</span>
        </button>
      {/each}
    </div>
  {/each}
</section>
