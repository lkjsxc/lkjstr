<script lang="ts">
  import type { SettingRecord } from '$lib/settings/settings-key';
  import SettingsValueEditor from './SettingsValueEditor.svelte';

  type Props = {
    setting: SettingRecord;
    save: (key: string, value: unknown) => void;
    reset: (key: string) => void;
  };

  let props: Props = $props();
  let dirty = $derived(
    JSON.stringify(props.setting.value) !==
      JSON.stringify(props.setting.defaultValue),
  );
</script>

<article class="setting-row">
  <div class="setting-key">
    <strong>{props.setting.label}</strong>
    <span>{props.setting.key}</span>
  </div>
  <p>{props.setting.description}</p>
  <SettingsValueEditor
    setting={props.setting}
    save={props.save}
    reset={props.reset}
  />
  <div class="setting-badges">
    <small>{props.setting.valueType}</small>
    {#if dirty}<small>Changed</small>{/if}
  </div>
</article>
