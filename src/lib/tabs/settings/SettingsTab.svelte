<script lang="ts">
  import { onMount } from 'svelte';
  import SettingsSearch from '$lib/components/settings/SettingsSearch.svelte';
  import SettingsTable from '$lib/components/settings/SettingsTable.svelte';
  import type { SettingRecord } from '$lib/settings/settings-key';
  import {
    settingNamespaces,
    searchSettings,
  } from '$lib/settings/settings-search';
  import {
    importSettingsJson,
    loadSettings,
    resetNamespace,
    resetSetting,
    saveSetting,
  } from '$lib/settings/settings-store';

  let settings = $state<SettingRecord[]>([]);
  let query = $state('');
  let namespace = $state('all');
  let visible = $derived(searchSettings(settings, query, namespace));
  let namespaces = $derived(settingNamespaces(settings));

  onMount(async () => {
    settings = await loadSettings();
    applyAppearance(settings);
  });

  async function save(key: string, value: unknown): Promise<void> {
    try {
      settings = await saveSetting(settings, key, value);
      applyAppearance(settings);
    } catch {
      settings = await loadSettings();
    }
  }

  async function reset(key: string): Promise<void> {
    settings = await resetSetting(key);
    applyAppearance(settings);
  }

  async function resetCurrentNamespace(): Promise<void> {
    if (namespace === 'all') return;
    settings = await resetNamespace(namespace);
    applyAppearance(settings);
  }

  async function importJson(): Promise<void> {
    const raw = window.prompt('Settings JSON');
    if (!raw) return;
    settings = await importSettingsJson(raw);
    applyAppearance(settings);
  }

  function applyAppearance(records: readonly SettingRecord[]): void {
    const root = document.documentElement;
    for (const record of records) {
      if (record.key === 'appearance.radius.ui')
        root.style.setProperty('--radius-ui', `${record.value}px`);
      if (record.key === 'appearance.radius.button')
        root.style.setProperty('--radius-button', `${record.value}px`);
      if (record.key === 'appearance.radius.tab')
        root.style.setProperty('--radius-tab', `${record.value}px`);
    }
  }
</script>

<section class="settings-tab">
  <h2>Settings</h2>
  <SettingsSearch
    {query}
    {namespace}
    {namespaces}
    updateQuery={(value) => (query = value)}
    updateNamespace={(value) => (namespace = value)}
  />
  <div class="settings-actions">
    <button
      type="button"
      onclick={() => navigator.clipboard?.writeText(JSON.stringify(settings))}
      >Copy JSON export</button
    >
    <button type="button" onclick={importJson}>Import JSON</button>
    <button type="button" onclick={resetCurrentNamespace}>
      Reset namespace
    </button>
  </div>
  <SettingsTable settings={visible} {save} {reset} />
</section>
