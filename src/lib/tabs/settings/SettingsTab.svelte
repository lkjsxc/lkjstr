<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import FormTabShell from '$lib/components/workspace/FormTabShell.svelte';
  import SettingsRow from '$lib/components/settings/SettingsRow.svelte';
  import type { SettingRecord } from '$lib/settings/settings-key';
  import {
    importSettingsJson,
    loadSettings,
    mergeSettings,
    resetSetting,
    saveSetting,
  } from '$lib/settings/settings-store';
  import {
    copySettingsJson,
    settingsCopyStatusText,
  } from '$lib/tabs/settings/settings-copy-status';
  import { registerTabRuntimeSnapshot } from '$lib/workspace/tab-runtime-registry';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';

  const scrollPositions = new SvelteMap<string, number>();

  type Props = {
    tabId?: string;
    visible?: boolean;
    restoreSnapshot?: TabSnapshotPayload;
    restoreScrollTop?: number;
  };

  let props: Props = $props();
  let settings = $state<SettingRecord[]>(mergeSettings([]));
  let root = $state<HTMLElement | undefined>(undefined);
  let importOpen = $state(false);
  let importDraft = $state('');
  let importStatus = $state('');
  let pendingRestoreScrollTop = $state<number | undefined>(undefined);
  let restoredFields = false;
  let changedCount = $derived(
    settings.filter(
      (setting) =>
        JSON.stringify(setting.value) !== JSON.stringify(setting.defaultValue),
    ).length,
  );

  function applyScrollTop(): void {
    if (!root) return;
    const remembered = scrollPositions.get(scrollKey());
    const target = remembered ?? pendingRestoreScrollTop;
    if (target !== undefined) root.scrollTop = target;
  }

  onMount(async () => {
    settings = await loadSettings();
    applyAppearance(settings);
    await tick();
    applyScrollTop();
  });

  $effect(() => {
    if (props.restoreScrollTop !== undefined)
      pendingRestoreScrollTop = props.restoreScrollTop;
    void props.tabId;
    if (settings.length === 0) return;
    void tick().then(() => applyScrollTop());
  });

  $effect(() => {
    if (restoredFields || props.restoreSnapshot?.kind !== 'tool') return;
    const fields = props.restoreSnapshot.fields;
    importOpen = fields?.settingsImportOpen === 'true';
    importDraft = fields?.settingsImportDraft ?? importDraft;
    importStatus = fields?.settingsImportStatus ?? importStatus;
    restoredFields = true;
  });

  $effect(() =>
    registerTabRuntimeSnapshot(props.tabId ?? 'settings', () => ({
      kind: 'tool',
      fields: {
        settingsImportDraft: importDraft,
        settingsImportOpen: String(importOpen),
        settingsImportStatus: importStatus,
      },
    })),
  );

  $effect(() => {
    if (!props.visible || settings.length === 0) return;
    void tick().then(() => applyScrollTop());
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

  async function copySettingsExport(): Promise<void> {
    const status = await copySettingsJson(
      'Settings JSON export',
      JSON.stringify(settings),
      navigator.clipboard,
    );
    importStatus = settingsCopyStatusText(status);
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

<FormTabShell label="Settings" class="settings-tab" bind:scrollOwner={root}>
  <header class="settings-header">
    <span>{changedCount} changed</span>
    <div class="settings-actions">
      <button
        type="button"
        onclick={() => {
          void copySettingsExport();
        }}
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
</FormTabShell>
