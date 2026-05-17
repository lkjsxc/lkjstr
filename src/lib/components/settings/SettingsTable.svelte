<script lang="ts">
  import type { SettingRecord } from '$lib/settings/settings-key';
  import SettingsValueEditor from './SettingsValueEditor.svelte';

  type Props = {
    settings: SettingRecord[];
    selectedKey: string | null;
    save: (key: string, value: unknown) => void;
    reset: (key: string) => void;
    select: (key: string) => void;
  };

  let props: Props = $props();
</script>

<div class="settings-list">
  {#each props.settings as setting (setting.key)}
    {@const dirty =
      JSON.stringify(setting.value) !== JSON.stringify(setting.defaultValue)}
    <article
      class:active={props.selectedKey === setting.key}
      class="setting-row"
    >
      <button
        type="button"
        class="setting-key"
        onclick={() => props.select(setting.key)}
      >
        <strong>{setting.label}</strong>
        <span>{setting.key}</span>
      </button>
      <p>{setting.description}</p>
      <SettingsValueEditor {setting} save={props.save} reset={props.reset} />
      <div class="setting-badges">
        <small>{setting.valueType}</small>
        {#if dirty}
          <small>Changed</small>
        {/if}
        {#if setting.requiresReload}
          <small>Requires reload</small>
        {/if}
      </div>
    </article>
  {/each}
</div>
