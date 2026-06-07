<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import type { RelaySet } from '$lib/relays/relay-store';
  import type { CustomEmoji } from '$lib/protocol';
  import { publishTweet } from '$lib/tweet/publish';
  import {
    clearTweetDraft,
    loadTweetDraftWithLegacy,
    saveTweetDraft,
    snapshotTweetDraft,
    type TweetAttachment,
  } from '$lib/tweet/draft-store';
  // prettier-ignore
  import { acceptedTweetMedia, uploadTweetFiles } from '$lib/tweet/media-upload-files';
  import { loadTweetUploadSettings } from '$lib/tweet/settings';
  // prettier-ignore
  import { dedupeCustomEmojiByShortcode, loadAccountEmojiSource } from '$lib/emoji/source';
  import { settingsChangedEvent } from '$lib/settings/settings-events';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';
  import TweetTabView from './TweetTabView.svelte';
  // prettier-ignore
  import { defaultTweetUploadSettings, tweetPublishContent, tweetPublishTags, upsertCustomEmoji } from './tweet-tab-helpers';
  type Props = {
    tabId: string;
    activeAccount?: Account;
    relaySets: readonly RelaySet[];
    openUploadSettings: () => void;
  };
  let props: Props = $props();
  let content = $state('');
  let message = $state('');
  let publishing = $state(false);
  let uploading = $state(false);
  let sensitive = $state(false);
  let warningReason = $state('');
  let uploadSettings = $state(defaultTweetUploadSettings);
  let attachments = $state<TweetAttachment[]>([]);
  let customEmojis = $state<CustomEmoji[]>([]);
  let availableCustomEmojis = $state<CustomEmoji[]>([]);
  let focusNonce = $state(0);
  let emojiLoadRequest = 0;
  let draftTouched = false;
  let destroyed = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let draftId = $derived(`tab:${props.tabId}`);
  let emojiSourceKey = $derived(
    `${props.activeAccount?.pubkey ?? ''}|${timelineRelays(props.relaySets).join('\u0000')}`,
  );
  let allCustomEmojis = $derived(
    dedupeCustomEmojiByShortcode([...availableCustomEmojis, ...customEmojis]),
  );
  let hasSigner = $derived(Boolean(props.activeAccount?.capabilities.sign));
  // prettier-ignore
  let canPublish = $derived(!publishing && !uploading && hasSigner && (content.trim().length > 0 || attachments.length > 0));

  onMount(() => {
    void loadInitialState();
    const reloadSettings = () => void loadUploadSettings();
    window.addEventListener(settingsChangedEvent, reloadSettings);
    return () => {
      destroyed = true;
      window.removeEventListener(settingsChangedEvent, reloadSettings);
      void flushDraft();
    };
  });

  $effect(() => {
    const key = emojiSourceKey;
    if (key === undefined) return;
    const request = ++emojiLoadRequest;
    const pubkey = props.activeAccount?.pubkey;
    const relays = timelineRelays(props.relaySets);
    void loadAccountEmojiSource({ pubkey, relays }).then((emoji) => {
      if (!destroyed && request === emojiLoadRequest)
        availableCustomEmojis = emoji;
    });
  });
  async function loadInitialState(): Promise<void> {
    const [draft, settings] = await Promise.all([
      loadTweetDraftWithLegacy(draftId),
      loadTweetUploadSettings(),
    ]);
    if (destroyed) return;
    if (!draftTouched) {
      content = draft?.content ?? '';
      attachments = [...(draft?.attachments ?? [])];
      customEmojis = [...(draft?.customEmojis ?? [])];
      sensitive = Boolean(draft?.sensitive);
      warningReason = draft?.contentWarningReason ?? '';
    }
    uploadSettings = settings;
  }

  // prettier-ignore
  async function loadUploadSettings(): Promise<void> { const settings = await loadTweetUploadSettings(); if (!destroyed) uploadSettings = settings; }

  function touchDraft(): void {
    draftTouched = true;
    snapshot();
    queueSave();
  }

  // prettier-ignore
  function snapshot(): void { snapshotTweetDraft(draftId, content, props.activeAccount?.id ?? null, attachments, customEmojis, sensitive, warningReason); }

  // prettier-ignore
  async function save(): Promise<void> { await saveTweetDraft(content, props.activeAccount?.id ?? null, attachments, customEmojis, sensitive, warningReason, draftId); }

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
    if (destroyed) return;
    const result = await publishTweet(
      tweetPublishContent(content, attachments),
      props.relaySets,
      tweetPublishTags({
        content,
        attachments,
        customEmojis: allCustomEmojis,
        sensitive,
        warningReason,
      }),
    );
    if (destroyed) return;
    publishing = false;
    if (!result.ok) {
      message = result.message;
      return;
    }
    content = '';
    attachments = [];
    customEmojis = [];
    sensitive = false;
    warningReason = '';
    message = '';
    await Promise.all([clearTweetDraft(draftId), clearTweetDraft('main')]);
    await tick();
    if (destroyed) return;
    focusNonce += 1;
    // prettier-ignore
    void result.delivery.then((results) => { if (!destroyed && results.every((item) => !item.accepted)) message = 'All relays rejected the event.'; }).catch((error) => { if (!destroyed) message = error instanceof Error ? error.message : 'Relay publishing failed.'; });
  }

  async function uploadFiles(files: FileList | File[]): Promise<void> {
    const pending = acceptedTweetMedia(files);
    if (pending.length === 0) return;
    if (!uploadSettings.server.trim()) {
      message = 'Configure media upload in Upload Settings.';
      return;
    }
    uploading = true;
    message = '';
    try {
      const uploaded = await uploadTweetFiles(pending, uploadSettings);
      if (destroyed) return;
      attachments = [...attachments, ...uploaded];
      snapshot();
      await flushDraft();
      message = `Uploaded ${uploaded.length} media file(s).`;
    } catch (error) {
      if (destroyed) return;
      message = error instanceof Error ? error.message : 'Media upload failed.';
    } finally {
      if (!destroyed) uploading = false;
    }
  }

  // prettier-ignore
  function handlePaste(event: ClipboardEvent): void { const files = event.clipboardData?.files; if (files?.length) void uploadFiles(files); }

  function removeAttachment(url: string): void {
    attachments = attachments.filter((item) => item.url !== url);
    snapshot();
    void flushDraft();
  }

  // prettier-ignore
  function addCustomEmoji(emoji: CustomEmoji): void { customEmojis = upsertCustomEmoji(customEmojis, emoji); }
</script>

<section class="data-tab form-tab" aria-label="Tweet">
  <!-- prettier-ignore -->
  <TweetTabView tabId={props.tabId} bind:sensitive bind:warningReason bind:content {attachments} customEmojis={allCustomEmojis} {uploading} {publishing} {hasSigner} {uploadSettings} {canPublish} {message} {focusNonce} {touchDraft} {flushDraft} {uploadFiles} {publish} {removeAttachment} {handlePaste} addCustomEmoji={addCustomEmoji} openUploadSettings={props.openUploadSettings} />
</section>
