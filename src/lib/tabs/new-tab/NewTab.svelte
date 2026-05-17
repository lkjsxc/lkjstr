<script lang="ts">
  import { parsePubkey } from '$lib/accounts/account';
  import { decodeEntity } from '$lib/protocol';
  import type { TabKind } from '$lib/workspace/tab';
  import { newTabOptions, type NewTabOption } from './new-tab-options';

  type Props = {
    tabId: string;
    convert: (
      tabId: string,
      kind: TabKind,
      config?: Record<string, unknown>,
    ) => void;
  };

  let { tabId, convert }: Props = $props();
  let profileInput = $state('');
  let threadInput = $state('');
  let filterInput = $state('{"kinds":[1],"limit":50}');
  let error = $state('');

  function choose(option: NewTabOption): void {
    error = '';
    if (option.needsInput === 'profile') return chooseProfile();
    if (option.needsInput === 'thread') return chooseThread();
    if (option.needsInput === 'filter') return chooseFilter();
    convert(tabId, option.kind);
  }

  function chooseProfile(): void {
    const pubkey = parsePubkey(profileInput);
    if (!pubkey) return void (error = 'Enter a hex pubkey or npub.');
    convert(tabId, 'profile', { pubkey });
  }

  function chooseThread(): void {
    const decoded = decodeEntity(threadInput.trim());
    const eventId =
      decoded?.type === 'note' || decoded?.type === 'nevent'
        ? String(decoded.data)
        : threadInput.trim();
    if (!/^[0-9a-f]{64}$/.test(eventId))
      return void (error = 'Enter a note, nevent, or hex event id.');
    convert(tabId, 'thread', { eventId });
  }

  function chooseFilter(): void {
    try {
      convert(tabId, 'timeline', { filters: [JSON.parse(filterInput)] });
    } catch {
      error = 'Filter JSON is invalid.';
    }
  }
</script>

<section class="new-tab">
  <h2>New Tab</h2>
  {#if error}
    <p role="alert">{error}</p>
  {/if}
  <div class="new-tab-inputs">
    <label>Profile pubkey <input bind:value={profileInput} /></label>
    <label>Thread event <input bind:value={threadInput} /></label>
    <label>Custom filter <textarea bind:value={filterInput}></textarea></label>
  </div>
  {#each ['primary', 'secondary'] as group (group)}
    <div class="option-grid" aria-label={`${group} options`}>
      {#each newTabOptions.filter((option) => option.group === group) as option (option.label)}
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
