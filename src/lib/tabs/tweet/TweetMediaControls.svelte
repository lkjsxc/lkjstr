<script lang="ts">
  import {
    presetFile,
    tweetMediaPresets,
    type TweetMediaPreset,
  } from '$lib/tweet/media-presets';

  type Props = {
    uploading: boolean;
    publishing: boolean;
    hasSigner: boolean;
    uploadServer: string;
    canPublish: boolean;
    uploadFiles: (files: FileList | File[]) => Promise<void>;
    publish: () => Promise<void>;
  };

  let props: Props = $props();
  let selectedPresetId = $state(tweetMediaPresets[0]?.id ?? '');
  let canUpload = $derived(
    !props.uploading && props.hasSigner && Boolean(props.uploadServer.trim()),
  );

  async function uploadPreset(): Promise<void> {
    const preset = tweetMediaPresets.find(
      (item) => item.id === selectedPresetId,
    );
    if (!preset) return;
    await props.uploadFiles([await presetFile(preset)]);
  }

  function presetLabel(preset: TweetMediaPreset): string {
    return `${preset.label} preset`;
  }
</script>

<div class="toolbar tweet-media-controls">
  <label class="button-like" for="tweet-media">Attach media</label>
  <input
    id="tweet-media"
    name="tweet-media"
    type="file"
    accept="image/*,video/*"
    multiple
    disabled={!canUpload}
    onchange={(event) => {
      const files = event.currentTarget.files;
      if (files) void props.uploadFiles(files);
      event.currentTarget.value = '';
    }}
  />
  <select
    bind:value={selectedPresetId}
    aria-label="Bundled media preset"
    id="tweet-media-preset"
    name="tweet-media-preset"
  >
    {#each tweetMediaPresets as preset (preset.id)}
      <option value={preset.id}>{presetLabel(preset)}</option>
    {/each}
  </select>
  <button type="button" disabled={!canUpload} onclick={uploadPreset}>
    Use preset
  </button>
  <button type="button" disabled={!props.canPublish} onclick={props.publish}>
    {props.publishing
      ? 'Publishing...'
      : props.uploading
        ? 'Uploading...'
        : 'Publish'}
  </button>
</div>
