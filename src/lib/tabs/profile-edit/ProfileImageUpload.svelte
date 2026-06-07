<script lang="ts">
  import UploadGateHint from '$lib/components/media/UploadGateHint.svelte';

  type Props = {
    id: string;
    label: string;
    uploading: boolean;
    uploadConfigured: boolean;
    openUploadSettings: () => void;
    upload: (files: FileList | null) => void;
  };

  let props: Props = $props();
  let canUpload = $derived(props.uploadConfigured && !props.uploading);
</script>

<div class="toolbar">
  <span class="sr-only">{props.label}</span>
  {#if canUpload}
    <input
      class="sr-only"
      id={props.id}
      type="file"
      accept="image/*"
      onchange={(event) => props.upload(event.currentTarget.files)}
    />
    <label for={props.id}>
      {props.uploading ? 'Uploading...' : props.label}
    </label>
  {:else if !props.uploadConfigured}
    <button type="button" onclick={props.openUploadSettings}>
      {props.label}
    </button>
    <UploadGateHint openUploadSettings={props.openUploadSettings} />
  {:else}
    <span class="toolbar__disabled" aria-disabled="true">
      {props.uploading ? 'Uploading...' : props.label}
    </span>
  {/if}
</div>

<style>
  .toolbar__disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
</style>
