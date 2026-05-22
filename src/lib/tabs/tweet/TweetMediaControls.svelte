<script lang="ts">
  import { ImagePlus } from '@lucide/svelte';
  import EmojiPaletteButton from '$lib/components/emoji/EmojiPaletteButton.svelte';
  import type { CustomEmoji } from '$lib/protocol';

  type Props = {
    inputId: string;
    uploading: boolean;
    publishing: boolean;
    hasSigner: boolean;
    uploadServer: string;
    canPublish: boolean;
    customEmojis: readonly CustomEmoji[];
    uploadFiles: (files: FileList | File[]) => Promise<void>;
    publish: () => Promise<void>;
    insertUnicodeEmoji: (emoji: string) => void;
    insertCustomEmoji: (emoji: CustomEmoji) => void;
  };

  let props: Props = $props();
  let canUpload = $derived(
    !props.uploading && props.hasSigner && Boolean(props.uploadServer.trim()),
  );
</script>

<div class="tweet-toolbar">
  <label
    class="button-like icon-button"
    for={props.inputId}
    title="Attach media"
  >
    <ImagePlus size={16} />
    <span class="sr-only">Attach media</span>
  </label>
  <input
    class="sr-only"
    id={props.inputId}
    name={props.inputId}
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
  <EmojiPaletteButton
    customEmojis={props.customEmojis}
    disabled={props.publishing}
    onUnicode={props.insertUnicodeEmoji}
    onCustom={props.insertCustomEmoji}
  />
  <button
    class="tweet-toolbar__publish"
    type="button"
    disabled={!props.canPublish}
    onclick={props.publish}
  >
    {props.publishing
      ? 'Publishing...'
      : props.uploading
        ? 'Uploading...'
        : 'Publish'}
  </button>
</div>
