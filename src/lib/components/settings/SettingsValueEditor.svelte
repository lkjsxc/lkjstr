<script lang="ts">
  import type { SettingRecord } from '$lib/settings/settings-key';
  import {
    tweetMediaUploadProviders,
    validCustomUploadServer,
  } from '$lib/tweet/media-upload-providers';

  type Props = {
    setting: SettingRecord;
    save: (key: string, value: unknown) => void;
    reset: (key: string) => void;
  };

  let props: Props = $props();
  let draft = $state('');
  let draftKey = $state('');
  let savedDraft = $state('');
  let error = $state('');

  $effect(() => {
    const next = displayValue(props.setting);
    if (props.setting.key !== draftKey || draft === savedDraft) {
      draftKey = props.setting.key;
      draft = next;
      savedDraft = next;
      error = '';
    }
  });

  function saveText(): void {
    try {
      if (props.setting.key === 'tweet.mediaUploadCustomServer')
        validateCustomServer(draft);
      const value =
        props.setting.valueType === 'json' ? JSON.parse(draft) : draft;
      props.save(props.setting.key, value);
      savedDraft = displayValue({ ...props.setting, value });
      error = '';
    } catch (caught) {
      error =
        caught instanceof Error ? caught.message : 'Invalid setting value.';
    }
  }

  function displayValue(setting: SettingRecord): string {
    return setting.valueType === 'json'
      ? JSON.stringify(setting.value, null, 2)
      : String(setting.value ?? '');
  }

  function validateCustomServer(value: string): void {
    if (!validCustomUploadServer(value))
      throw new Error('Custom upload server must be blank or HTTPS.');
  }

  function optionLabel(value: string): string {
    if (props.setting.key !== 'tweet.mediaUploadProvider') return value;
    return (
      tweetMediaUploadProviders.find((provider) => provider.id === value)
        ?.label ?? value
    );
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
      <option value={option}>{optionLabel(option)}</option>
    {/each}
  </select>
{:else if props.setting.valueType === 'number'}
  <input
    aria-label={`Edit ${props.setting.key}`}
    type="number"
    min={props.setting.min}
    max={props.setting.max}
    step={props.setting.step}
    value={String(props.setting.value)}
    oninput={(event) =>
      props.save(props.setting.key, event.currentTarget.value)}
  />
{:else if props.setting.valueType === 'json'}
  <textarea
    aria-label={`Edit ${props.setting.key}`}
    value={draft}
    rows="4"
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
{#if error}<small role="alert">{error}</small>{/if}
