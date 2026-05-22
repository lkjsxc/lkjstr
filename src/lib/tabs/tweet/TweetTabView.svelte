<script lang="ts">
  import type { CustomEmoji } from '$lib/protocol';
  import type { TweetAttachment } from '$lib/tweet/draft-store';
  import type { UploadSettings } from '$lib/tweet/media-upload';
  import TweetComposer from './TweetComposer.svelte';

  type Props = {
    tabId: string;
    content: string;
    sensitive: boolean;
    warningReason: string;
    attachments: TweetAttachment[];
    customEmojis: CustomEmoji[];
    uploading: boolean;
    publishing: boolean;
    hasSigner: boolean;
    uploadSettings: UploadSettings;
    canPublish: boolean;
    message: string;
    confirmedRelays: string;
    focusNonce: number;
    touchDraft: () => void;
    flushDraft: () => Promise<void>;
    uploadFiles: (files: FileList | File[]) => Promise<void>;
    publish: () => Promise<void>;
    removeAttachment: (url: string) => void;
    handlePaste: (event: ClipboardEvent) => void;
    addCustomEmoji: (emoji: CustomEmoji) => void;
  };

  let {
    content = $bindable(),
    sensitive = $bindable(),
    warningReason = $bindable(),
    ...props
  }: Props = $props();
</script>

<TweetComposer
  tabId={props.tabId}
  bind:sensitive
  bind:warningReason
  bind:content
  attachments={props.attachments}
  customEmojis={props.customEmojis}
  uploading={props.uploading}
  publishing={props.publishing}
  hasSigner={props.hasSigner}
  uploadSettings={props.uploadSettings}
  canPublish={props.canPublish}
  message={props.message}
  confirmedRelays={props.confirmedRelays}
  focusNonce={props.focusNonce}
  touchDraft={props.touchDraft}
  flushDraft={props.flushDraft}
  uploadFiles={props.uploadFiles}
  publish={props.publish}
  removeAttachment={props.removeAttachment}
  handlePaste={props.handlePaste}
  addCustomEmoji={props.addCustomEmoji}
/>
