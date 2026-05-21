<script lang="ts">
  import type { UploadSettings } from '$lib/tweet/media-upload';
  import type { TweetAttachment } from '$lib/tweet/draft-store';
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
    uploading: boolean;
    publishing: boolean;
    hasSigner: boolean;
    passkeyLocked: boolean;
    uploadSettings: UploadSettings;
    canPublish: boolean;
    message: string;
    confirmedRelays: string;
    touchDraft: () => void;
    flushDraft: () => Promise<void>;
    uploadFiles: (files: FileList | File[]) => Promise<void>;
    publish: () => Promise<void>;
    removeAttachment: (url: string) => void;
    handlePaste: (event: ClipboardEvent) => void;
  };

  let {
    content = $bindable(),
    sensitive = $bindable(),
    warningReason = $bindable(),
    ...props
  }: Props = $props();
</script>

<textarea
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
<TweetAttachments
  attachments={props.attachments}
  remove={props.removeAttachment}
/>
<TweetMediaControls
  inputId={`tweet-media-${props.tabId}`}
  uploading={props.uploading}
  publishing={props.publishing}
  hasSigner={props.hasSigner}
  uploadServer={props.uploadSettings.server}
  canPublish={props.canPublish}
  uploadFiles={props.uploadFiles}
  publish={props.publish}
/>
{#if props.passkeyLocked}
  <p>Unlock the active passkey account before publishing.</p>
{:else if !props.hasSigner}
  <p>Add a signing account before publishing.</p>
{/if}
{#if props.message}
  <p role="status">{props.message}</p>
{:else if props.publishing}
  <p role="status">Publishing...</p>
{:else if props.confirmedRelays}
  <p role="status">Published to {props.confirmedRelays} relays.</p>
{/if}
