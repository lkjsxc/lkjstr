<script lang="ts">
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
  let canUpload = $derived(
    !props.uploading && props.hasSigner && Boolean(props.uploadServer.trim()),
  );
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
  <button type="button" disabled={!props.canPublish} onclick={props.publish}>
    {props.publishing
      ? 'Publishing...'
      : props.uploading
        ? 'Uploading...'
        : 'Publish'}
  </button>
</div>
