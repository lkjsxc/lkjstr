<script lang="ts">
  import { onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import { contentWarningTag } from '$lib/protocol';
  import TweetComposer from './TweetComposer.svelte';
  import { publishTweet } from '$lib/tweet/publish';
  import {
    clearTweetDraft,
    loadTweetDraftWithLegacy,
    saveTweetDraft,
    snapshotTweetDraft,
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
    tabId: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
  };

  let props: Props = $props();
  let content = $state('');
  let message = $state('');
  let publishing = $state(false);
  let confirmedRelays = $state('');
  let uploading = $state(false);
  let sensitive = $state(false);
  let warningReason = $state('');
  let uploadSettings = $state<UploadSettings>({
    provider: 'nostr-build',
    customServer: '',
    server: 'https://nostr.build',
    noTransform: true,
  });
  let attachments = $state<TweetAttachment[]>([]);
  let draftTouched = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let draftId = $derived(`tab:${props.tabId}`);
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
      loadTweetDraftWithLegacy(draftId),
      loadTweetUploadSettings(),
    ]);
    if (!draftTouched) {
      content = draft?.content ?? '';
      attachments = [...(draft?.attachments ?? [])];
      sensitive = Boolean(draft?.sensitive);
      warningReason = draft?.contentWarningReason ?? '';
    }
    uploadSettings = settings;
  }

  async function loadUploadSettings(): Promise<void> {
    uploadSettings = await loadTweetUploadSettings();
  }

  function touchDraft(): void {
    draftTouched = true;
    snapshot();
    queueSave();
  }

  // prettier-ignore
  function snapshot(): void { snapshotTweetDraft(draftId, content, props.activeAccount?.id ?? null, attachments, sensitive, warningReason); }

  // prettier-ignore
  async function save(): Promise<void> { await saveTweetDraft(content, props.activeAccount?.id ?? null, attachments, sensitive, warningReason, draftId); }

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
    confirmedRelays = '';
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
    confirmedRelays = `${accepted}/${result.results.length}`;
    message = `Published to ${confirmedRelays} relays.`;
    content = '';
    attachments = [];
    sensitive = false;
    warningReason = '';
    await Promise.all([clearTweetDraft(draftId), clearTweetDraft('main')]);
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
      snapshot();
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

  // prettier-ignore
  function tags() { return [...attachments.map((item) => item.imeta), ...(sensitive ? [contentWarningTag(warningReason)] : [])]; }

  function removeAttachment(url: string): void {
    attachments = attachments.filter((item) => item.url !== url);
    snapshot();
    void flushDraft();
  }
</script>

<section class="data-tab">
  <h2>Tweet</h2>
  <TweetComposer
    tabId={props.tabId}
    bind:sensitive
    bind:warningReason
    bind:content
    {attachments}
    {uploading}
    {publishing}
    {hasSigner}
    {uploadSettings}
    {canPublish}
    {message}
    {confirmedRelays}
    {touchDraft}
    {flushDraft}
    {uploadFiles}
    {publish}
    {removeAttachment}
    {handlePaste}
  />
</section>
