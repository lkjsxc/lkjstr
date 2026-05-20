<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { NostrTag } from '$lib/protocol';
  import TweetAttachments from './TweetAttachments.svelte';
  import TweetMediaControls from './TweetMediaControls.svelte';
  import { publishTweet } from '$lib/tweet/publish';
  import {
    clearTweetDraft,
    loadTweetDraft,
    saveTweetDraft,
    type TweetAttachment,
  } from '$lib/tweet/draft-store';
  import type { UploadSettings } from '$lib/tweet/media-upload';
  import {
    acceptedTweetMedia,
    uploadTweetFiles,
  } from '$lib/tweet/media-upload-files';
  import { loadTweetUploadSettings } from '$lib/tweet/settings';
  import { settingsChangedEvent } from '$lib/settings/settings-events';

  type Props = {
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let content = $state('');
  let message = $state('');
  let publishing = $state(false);
  let uploading = $state(false);
  let uploadSettings = $state<UploadSettings>({
    provider: 'disabled',
    customServer: '',
    server: '',
    noTransform: true,
  });
  let attachments = $state<TweetAttachment[]>([]);
  let draftTouched = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let hasSigner = $derived(
    Boolean(
      props.activeAccount?.enabled && props.activeAccount.capabilities.sign,
    ),
  );
  let canPublish = $derived(
    !publishing &&
      !uploading &&
      hasSigner &&
      (content.trim().length > 0 || attachments.length > 0),
  );

  onMount(() => {
    void loadInitialState();
    const reloadSettings = () => void loadUploadSettings();
    window.addEventListener(settingsChangedEvent, reloadSettings);
    return () => {
      window.removeEventListener(settingsChangedEvent, reloadSettings);
      void flushDraft();
    };
  });

  async function loadInitialState(): Promise<void> {
    const [draft, settings] = await Promise.all([
      loadTweetDraft(),
      loadTweetUploadSettings(),
    ]);
    if (!draftTouched) {
      content = draft?.content ?? '';
      attachments = [...(draft?.attachments ?? [])];
    }
    applyUploadSettings(settings);
  }

  async function loadUploadSettings(): Promise<void> {
    applyUploadSettings(await loadTweetUploadSettings());
  }

  function applyUploadSettings(settings: UploadSettings): void {
    uploadSettings = settings;
  }

  function touchDraft(): void {
    draftTouched = true;
    queueSave();
  }

  async function save(): Promise<void> {
    await saveTweetDraft(content, props.activeAccount?.id ?? null, attachments);
  }

  function queueSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flushDraft(), 400);
  }

  async function flushDraft(): Promise<void> {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = undefined;
    await save();
  }

  async function publish(): Promise<void> {
    if (!canPublish) return;
    publishing = true;
    message = '';
    await flushDraft();
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
    const pending = acceptedTweetMedia(files);
    if (pending.length === 0) return;
    if (!uploadSettings.server.trim()) {
      message = 'Configure a media upload server in Settings first.';
      return;
    }
    uploading = true;
    message = '';
    try {
      const uploaded = await uploadTweetFiles(pending, uploadSettings);
      attachments = [...attachments, ...uploaded];
      await flushDraft();
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
    void flushDraft();
  }
</script>

<section class="data-tab">
  <h2>Tweet</h2>
  <textarea
    aria-label="Tweet content"
    bind:value={content}
    id="tweet-content"
    name="tweet-content"
    oninput={touchDraft}
    onblur={() => void flushDraft()}
    onpaste={handlePaste}
    onkeydown={(event) => {
      if (event.ctrlKey && event.key === 'Enter') void publish();
    }}
  ></textarea>
  <TweetAttachments {attachments} remove={removeAttachment} />
  <TweetMediaControls
    {uploading}
    {publishing}
    {hasSigner}
    uploadServer={uploadSettings.server}
    {canPublish}
    {uploadFiles}
    {publish}
  />
  {#if !hasSigner}
    <p>Add a signing account before publishing.</p>
  {/if}
  {#if message}
    <p role="status">{message}</p>
  {/if}
</section>
