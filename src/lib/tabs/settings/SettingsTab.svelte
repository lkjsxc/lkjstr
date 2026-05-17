<script lang="ts">
  import { onMount } from 'svelte';
  import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
  import { groupSettings } from '$lib/settings/settings-groups';
  import type { SettingRecord } from '$lib/settings/settings-key';
  import {
    importSettingsJson,
    loadSettings,
    resetSetting,
    saveSetting,
  } from '$lib/settings/settings-store';

  let settings = $state<SettingRecord[]>([]);
  let groups = $derived(groupSettings(settings));
  let changedCount = $derived(
    settings.filter(
      (setting) =>
        JSON.stringify(setting.value) !== JSON.stringify(setting.defaultValue),
    ).length,
  );

  onMount(async () => {
    settings = await loadSettings();
    applyAppearance(settings);
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
    const raw = window.prompt('Settings JSON');
    if (!raw) return;
    settings = await importSettingsJson(raw);
    applyAppearance(settings);
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
</script>

<section class="settings-tab">
  <header class="settings-header">
    <h2>Settings</h2>
    <span>{changedCount} changed</span>
    <div class="settings-actions">
      <button
        type="button"
        onclick={() => navigator.clipboard?.writeText(JSON.stringify(settings))}
      >
        Copy JSON export
      </button>
      <button type="button" onclick={importJson}>Import JSON</button>
    </div>
  </header>
  <div class="settings-layout grouped">
    {#each groups as group (group.id)}
      <SettingsSection {group} {save} {reset} />
    {/each}
  </div>
</section>
