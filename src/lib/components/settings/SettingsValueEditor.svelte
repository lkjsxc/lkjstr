<script lang="ts">
  import type { SettingRecord } from '$lib/settings/settings-key';

  type Props = {
    setting: SettingRecord;
    save: (key: string, value: unknown) => void;
    reset: (key: string) => void;
  };

  let props: Props = $props();
  let draft = $derived(JSON.stringify(props.setting.value));

  function saveText(): void {
    try {
      const raw = draft.trim();
      const value = props.setting.valueType === 'json' ? JSON.parse(raw) : raw;
      props.save(props.setting.key, value);
    } catch {
      draft = JSON.stringify(props.setting.value);
    }
  }
</script>

{#if props.setting.valueType === 'boolean'}
  <input
    aria-label={`Edit ${props.setting.key}`}
    type="checkbox"
    checked={Boolean(props.setting.value)}
    onchange={(event) =>
      props.save(props.setting.key, event.currentTarget.checked)}
  />
{:else if props.setting.valueType === 'enum'}
  <select
    aria-label={`Edit ${props.setting.key}`}
    value={String(props.setting.value)}
    onchange={(event) =>
      props.save(props.setting.key, event.currentTarget.value)}
  >
    {#each props.setting.options ?? [] as option (option)}
      <option value={option}>{option}</option>
    {/each}
  </select>
{:else if props.setting.valueType === 'number'}
  <input
    aria-label={`Edit ${props.setting.key}`}
    type="number"
    value={String(props.setting.value)}
    oninput={(event) =>
      props.save(props.setting.key, event.currentTarget.value)}
  />
{:else if props.setting.valueType === 'json'}
  <textarea
    aria-label={`Edit ${props.setting.key}`}
    value={draft}
    rows="3"
    oninput={(event) => (draft = event.currentTarget.value)}
    onblur={saveText}
  ></textarea>
{:else if props.setting.sensitive}
  <span>masked</span>
{:else}
  <input
    aria-label={`Edit ${props.setting.key}`}
    value={draft}
    oninput={(event) => (draft = event.currentTarget.value)}
    onblur={saveText}
  />
{/if}
<button type="button" onclick={() => props.reset(props.setting.key)}
  >Reset</button
>
