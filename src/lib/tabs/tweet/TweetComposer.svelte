<script lang="ts">
  import type { UploadSettings } from '$lib/tweet/media-upload';
  import type { TweetAttachment } from '$lib/tweet/draft-store';
  import { tick } from 'svelte';
  import { customEmojiTokenText, type CustomEmoji } from '$lib/protocol';
  import { isSubmitShortcut } from '$lib/tweet/submit-shortcut';
  import TweetAttachments from './TweetAttachments.svelte';
  import TweetMediaControls from './TweetMediaControls.svelte';
  import TweetSensitiveControls from './TweetSensitiveControls.svelte';

  type Props = {
    tabId: string;
    content: string;
    sensitive: boolean;
    warningReason: string;
    attachments: TweetAttachment[];
    customEmojis: readonly CustomEmoji[];
    uploading: boolean;
    publishing: boolean;
    hasSigner: boolean;
    uploadSettings: UploadSettings;
    canPublish: boolean;
    message: string;
    touchDraft: () => void;
    flushDraft: () => Promise<void>;
    uploadFiles: (files: FileList | File[]) => Promise<void>;
    publish: () => Promise<void>;
    removeAttachment: (url: string) => void;
    handlePaste: (event: ClipboardEvent) => void;
    addCustomEmoji: (emoji: CustomEmoji) => void;
    focusNonce: number;
  };

  let {
    content = $bindable(),
    sensitive = $bindable(),
    warningReason = $bindable(),
    ...props
  }: Props = $props();
  let textarea: HTMLTextAreaElement | undefined = $state();
  let lastFocusNonce = 0;

  $effect(() => {
    if (props.focusNonce === lastFocusNonce) return;
    lastFocusNonce = props.focusNonce;
    void tick().then(() => textarea?.focus());
  });

  function insertText(text: string): void {
    if (!textarea) {
      content += text;
      props.touchDraft();
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    content = `${content.slice(0, start)}${text}${content.slice(end)}`;
    props.touchDraft();
    void tick().then(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function insertCustomEmoji(emoji: CustomEmoji): void {
    props.addCustomEmoji(emoji);
    insertText(customEmojiTokenText(emoji.shortcode));
    void props.flushDraft();
  }
</script>

<div class="tweet-composer">
  <textarea
    bind:this={textarea}
    aria-label="Tweet content"
    bind:value={content}
    id="tweet-content"
    name="tweet-content"
    oninput={props.touchDraft}
    onblur={() => void props.flushDraft()}
    onpaste={props.handlePaste}
    onkeydown={(event) => {
      if (isSubmitShortcut(event)) void props.publish();
    }}
  ></textarea>
  <TweetSensitiveControls
    bind:sensitive
    bind:warningReason
    touchDraft={props.touchDraft}
    flushDraft={props.flushDraft}
  />
  <div
    class="tweet-composer__attachments"
    data-testid="tweet-attachments-region"
  >
    <TweetAttachments
      attachments={props.attachments}
      remove={props.removeAttachment}
    />
    {#if !props.hasSigner}
      <p>Add a signing account before publishing.</p>
    {/if}
    {#if props.message}
      <p role="status">{props.message}</p>
    {:else if props.publishing}
      <p role="status">Publishing...</p>
    {/if}
  </div>
  <footer class="tweet-composer__footer" data-testid="tweet-composer-footer">
    <TweetMediaControls
      inputId={`tweet-media-${props.tabId}`}
      uploading={props.uploading}
      publishing={props.publishing}
      hasSigner={props.hasSigner}
      uploadServer={props.uploadSettings.server}
      canPublish={props.canPublish}
      customEmojis={props.customEmojis}
      uploadFiles={props.uploadFiles}
      publish={props.publish}
      insertUnicodeEmoji={insertText}
      {insertCustomEmoji}
    />
  </footer>
</div>

<style>
  .tweet-composer {
    display: grid;
    gap: var(--space-3);
    min-block-size: 0;
  }

  .tweet-composer__attachments {
    max-block-size: 14rem;
    min-block-size: 0;
    overflow: auto;
  }

  .tweet-composer__footer {
    border-block-start: 1px solid var(--color-border);
    padding-block-start: var(--space-2);
  }
</style>
