<script lang="ts">
  import type { SettingRecord } from '$lib/settings/settings-key';
  import SettingsValueEditor from './SettingsValueEditor.svelte';

  type Props = {
    settings: SettingRecord[];
    save: (key: string, value: unknown) => void;
    reset: (key: string) => void;
  };

  let props: Props = $props();
</script>

<table class="settings-table">
  <thead>
    <tr>
      <th>Key</th>
      <th>Value</th>
      <th>Default</th>
      <th>Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    {#each props.settings as setting (setting.key)}
      <tr>
        <td>
          <button
            type="button"
            class="link-button"
            onclick={() => navigator.clipboard?.writeText(setting.key)}
            >{setting.key}</button
          >
        </td>
        <td>
          <SettingsValueEditor
            {setting}
            save={props.save}
            reset={props.reset}
          />
        </td>
        <td
          >{setting.sensitive
            ? 'masked'
            : JSON.stringify(setting.defaultValue)}</td
        >
        <td>{setting.valueType}</td>
        <td>
          {setting.description}
          {#if JSON.stringify(setting.value) !== JSON.stringify(setting.defaultValue)}
            <small>Dirty</small>
          {/if}
          {#if setting.requiresReload}
            <small>Requires reload</small>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>
