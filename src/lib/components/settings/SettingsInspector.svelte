<script lang="ts">
  import type { SettingRecord } from '$lib/settings/settings-key';

  type Props = {
    setting?: SettingRecord;
    reset: (key: string) => void;
  };

  let props: Props = $props();
</script>

<aside class="settings-inspector" aria-label="Setting inspector">
  {#if props.setting}
    <h3>{props.setting.key}</h3>
    <p>{props.setting.description}</p>
    <dl>
      <dt>Type</dt>
      <dd>{props.setting.valueType}</dd>
      <dt>Default</dt>
      <dd>
        {props.setting.sensitive
          ? 'masked'
          : JSON.stringify(props.setting.defaultValue)}
      </dd>
      <dt>Current</dt>
      <dd>
        {props.setting.sensitive
          ? 'masked'
          : JSON.stringify(props.setting.value)}
      </dd>
    </dl>
    <textarea
      aria-label="Setting JSON preview"
      readonly
      rows="5"
      value={JSON.stringify(props.setting, null, 2)}
    ></textarea>
    <button type="button" onclick={() => props.reset(props.setting!.key)}>
      Reset key
    </button>
    <button
      type="button"
      onclick={() => navigator.clipboard?.writeText(props.setting!.key)}
    >
      Copy key
    </button>
  {:else}
    <h3>No setting selected</h3>
    <p>Select a setting to inspect its key, defaults, and stored value.</p>
  {/if}
</aside>
