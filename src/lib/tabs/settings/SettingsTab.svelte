<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import SettingsRow from '$lib/components/settings/SettingsRow.svelte';
  import type { SettingRecord } from '$lib/settings/settings-key';
  import {
    importSettingsJson,
    loadSettings,
    resetSetting,
    saveSetting,
  } from '$lib/settings/settings-store';

  const scrollPositions = new SvelteMap<string, number>();

  type Props = { tabId?: string };

  let props: Props = $props();
  let settings = $state<SettingRecord[]>([]);
  let root: HTMLElement | undefined;
  let importOpen = $state(false);
  let importDraft = $state('');
  let importStatus = $state('');
  let changedCount = $derived(
    settings.filter(
      (setting) =>
        JSON.stringify(setting.value) !== JSON.stringify(setting.defaultValue),
    ).length,
  );

  onMount(async () => {
    settings = await loadSettings();
    applyAppearance(settings);
    await tick();
    if (root) root.scrollTop = scrollPositions.get(scrollKey()) ?? 0;
  });

  onDestroy(() => {
    if (root) scrollPositions.set(scrollKey(), root.scrollTop);
  });

  async function save(key: string, value: unknown): Promise<void> {
    settings = await saveSetting(settings, key, value);
    applyAppearance(settings);
  }

  async function reset(key: string): Promise<void> {
    settings = await resetSetting(key);
    applyAppearance(settings);
  }

  async function importJson(): Promise<void> {
    try {
      settings = await importSettingsJson(importDraft);
      applyAppearance(settings);
      importStatus = 'Settings imported.';
      importDraft = '';
      importOpen = false;
    } catch (error) {
      importStatus =
        error instanceof Error ? error.message : 'Settings import failed.';
    }
  }

  function applyAppearance(records: readonly SettingRecord[]): void {
    const root = document.documentElement;
    const radius = records.find(
      (item) => item.key === 'appearance.cornerRadius',
    );
    if (!radius) return;
    root.style.setProperty('--radius-ui', `${radius.value}px`);
    root.style.setProperty('--radius-button', `${radius.value}px`);
    root.style.setProperty('--radius-tab', `${radius.value}px`);
  }

  function scrollKey(): string {
    return props.tabId ?? 'settings';
  }
</script>

<section class="settings-tab" aria-label="Settings" bind:this={root}>
  <header class="settings-header">
    <span>{changedCount} changed</span>
    <div class="settings-actions">
      <button
        type="button"
        onclick={() => navigator.clipboard?.writeText(JSON.stringify(settings))}
      >
        Copy JSON export
      </button>
      <button type="button" onclick={() => (importOpen = !importOpen)}>
        Import JSON
      </button>
    </div>
  </header>
  {#if importOpen}
    <form
      class="settings-import"
      onsubmit={(event) => {
        event.preventDefault();
        void importJson();
      }}
    >
      <textarea
        aria-label="Settings JSON import"
        bind:value={importDraft}
        id="settings-import-json"
        name="settings-import-json"
        rows="5"
      ></textarea>
      <button type="submit" disabled={!importDraft.trim()}>Import</button>
    </form>
  {/if}
  {#if importStatus}<p role="status">{importStatus}</p>{/if}
  <div class="settings-layout">
    {#each settings as setting (setting.key)}
      <SettingsRow {setting} {save} {reset} />
    {/each}
  </div>
</section>
