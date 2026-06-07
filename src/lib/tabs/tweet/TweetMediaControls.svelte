<script lang="ts">
  import { ImagePlus } from '@lucide/svelte';
  import EmojiPaletteButton from '$lib/components/emoji/EmojiPaletteButton.svelte';
  import UploadGateHint from '$lib/components/media/UploadGateHint.svelte';
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
    openUploadSettings: () => void;
  };

  let props: Props = $props();
  let uploadConfigured = $derived(Boolean(props.uploadServer.trim()));
  let canUpload = $derived(
    !props.uploading && props.hasSigner && uploadConfigured,
  );
</script>

<div class="tweet-toolbar">
  <div class="tweet-toolbar__tools">
    {#if canUpload}
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
        onchange={(event) => {
          const files = event.currentTarget.files;
          if (files) void props.uploadFiles(files);
          event.currentTarget.value = '';
        }}
      />
    {:else if props.hasSigner && !uploadConfigured}
      <button
        type="button"
        class="button-like icon-button"
        title="Configure media upload"
        onclick={props.openUploadSettings}
      >
        <ImagePlus size={16} />
        <span class="sr-only">Configure media upload</span>
      </button>
      <UploadGateHint openUploadSettings={props.openUploadSettings} />
    {:else}
      <span
        class="button-like icon-button icon-button--disabled"
        title="Attach media"
        aria-disabled="true"
      >
        <ImagePlus size={16} />
        <span class="sr-only">Attach media</span>
      </span>
    {/if}
    <EmojiPaletteButton
      customEmojis={props.customEmojis}
      disabled={props.publishing}
      onUnicode={props.insertUnicodeEmoji}
      onCustom={props.insertCustomEmoji}
    />
  </div>
  <div class="tweet-toolbar__publish-area" data-testid="tweet-publish-area">
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
</div>

<style>
  .tweet-toolbar {
    align-items: center;
    display: grid;
    gap: var(--space-2);
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .tweet-toolbar__tools {
    align-items: center;
    display: flex;
    gap: var(--space-2);
    min-width: 0;
  }

  .tweet-toolbar__publish-area {
    display: flex;
    inline-size: 9rem;
    justify-content: flex-end;
  }

  .tweet-toolbar__publish {
    inline-size: 100%;
  }
</style>
