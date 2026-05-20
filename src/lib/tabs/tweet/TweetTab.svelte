<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { NostrTag } from '$lib/protocol';
  import TweetAttachments from './TweetAttachments.svelte';
  import { publishTweet } from '$lib/tweet/publish';
  import {
    clearTweetDraft,
    loadTweetDraft,
    saveTweetDraft,
    type TweetAttachment,
  } from '$lib/tweet/draft-store';
  import { uploadTweetMedia } from '$lib/tweet/media-upload';
  import { loadTweetUploadSettings } from '$lib/tweet/settings';

  type Props = {
    accounts: Account[];
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let content = $state('');
  let message = $state('');
  let publishing = $state(false);
  let uploading = $state(false);
  let uploadServer = $state('');
  let uploadNoTransform = $state(true);
  let attachments = $state<TweetAttachment[]>([]);
  let hasSigner = $derived(
    props.accounts.some((item) => item.signerType === 'nip07'),
  );
  let canPublish = $derived(
    !publishing &&
      !uploading &&
      hasSigner &&
      (content.trim().length > 0 || attachments.length > 0),
  );

  onMount(async () => {
    const draft = await loadTweetDraft();
    content = draft?.content ?? '';
    attachments = [...(draft?.attachments ?? [])];
    const settings = await loadTweetUploadSettings();
    uploadServer = settings.server;
    uploadNoTransform = settings.noTransform;
  });

  async function save(): Promise<void> {
    await saveTweetDraft(content, props.accounts[0]?.id ?? null, attachments);
  }

  async function publish(): Promise<void> {
    if (!canPublish) return;
    publishing = true;
    message = '';
    await save();
    const result = await publishTweet(
      publishContent(),
      props.relaySets,
      tags(),
    );
    publishing = false;
    if (!result.ok) {
      message = result.message;
      return;
    }
    const accepted = result.results.filter((item) => item.accepted).length;
    message = `Published to ${accepted}/${result.results.length} relays.`;
    content = '';
    attachments = [];
    await clearTweetDraft();
  }

  async function uploadFiles(files: FileList | File[]): Promise<void> {
    const pending = Array.from(files).filter(
      (file) =>
        file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    if (pending.length === 0) return;
    if (!uploadServer.trim()) {
      message = 'Configure a media upload server in Settings first.';
      return;
    }
    uploading = true;
    message = '';
    try {
      const uploaded = [];
      for (const file of pending) {
        uploaded.push(
          await uploadTweetMedia(file, {
            server: uploadServer,
            noTransform: uploadNoTransform,
          }),
        );
      }
      attachments = [...attachments, ...uploaded];
      await save();
      message = `Uploaded ${uploaded.length} media file(s).`;
    } catch (error) {
      message = error instanceof Error ? error.message : 'Media upload failed.';
    } finally {
      uploading = false;
    }
  }

  function handlePaste(event: ClipboardEvent): void {
    const files = event.clipboardData?.files;
    if (files?.length) void uploadFiles(files);
  }

  function publishContent(): string {
    const urls = attachments.map((item) => item.url);
    return [content.trim(), ...urls].filter(Boolean).join('\n');
  }

  function tags(): NostrTag[] {
    return attachments.map((item) => item.imeta);
  }

  function removeAttachment(url: string): void {
    attachments = attachments.filter((item) => item.url !== url);
    void save();
  }
</script>

<section class="data-tab">
  <h2>Tweet</h2>
  <textarea
    aria-label="Tweet content"
    bind:value={content}
    id="tweet-content"
    name="tweet-content"
    oninput={() => save()}
    onpaste={handlePaste}
    onkeydown={(event) => {
      if (event.ctrlKey && event.key === 'Enter') void publish();
    }}
  ></textarea>
  <TweetAttachments {attachments} remove={removeAttachment} />
  <div class="toolbar">
    <label class="button-like" for="tweet-media">Attach media</label>
    <input
      id="tweet-media"
      name="tweet-media"
      type="file"
      accept="image/*,video/*"
      multiple
      disabled={uploading || !hasSigner || !uploadServer.trim()}
      onchange={(event) => {
        const files = event.currentTarget.files;
        if (files) void uploadFiles(files);
        event.currentTarget.value = '';
      }}
    />
    <button type="button" disabled={!canPublish} onclick={publish}>
      {publishing ? 'Publishing...' : uploading ? 'Uploading...' : 'Publish'}
    </button>
  </div>
  {#if !hasSigner}
    <p>Add a NIP-07 account before publishing.</p>
  {/if}
  {#if message}
    <p role="status">{message}</p>
  {/if}
</section>
