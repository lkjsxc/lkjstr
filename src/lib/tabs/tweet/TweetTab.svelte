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
  import {
    acceptedTweetMedia,
    uploadTweetFiles,
  } from '$lib/tweet/media-upload-files';
  import { loadTweetUploadSettings } from '$lib/tweet/settings';
  import { loadAccountEmojiSource } from '$lib/emoji/source';
  import { settingsChangedEvent } from '$lib/settings/settings-events';
  import { timelineRelays } from '$lib/timeline/timeline-subscription';
  import TweetTabView from './TweetTabView.svelte';
  import {
    defaultTweetUploadSettings,
    tweetPublishContent,
    tweetPublishTags,
    upsertCustomEmoji,
  } from './tweet-tab-helpers';

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
  let uploadSettings = $state(defaultTweetUploadSettings);
  let attachments = $state<TweetAttachment[]>([]);
  let customEmojis = $state<CustomEmoji[]>([]);
  let availableCustomEmojis = $state<CustomEmoji[]>([]);
  let focusNonce = $state(0);
  let draftTouched = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let draftId = $derived(`tab:${props.tabId}`);
  let hasSigner = $derived(Boolean(props.activeAccount?.capabilities.sign));
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
    const [draft, settings, sourceEmoji] = await Promise.all([
      loadTweetDraftWithLegacy(draftId),
      loadTweetUploadSettings(),
      loadAccountEmojiSource({
        pubkey: props.activeAccount?.pubkey,
        relays: timelineRelays(props.relaySets),
      }),
    ]);
    if (!draftTouched) {
      content = draft?.content ?? '';
      attachments = [...(draft?.attachments ?? [])];
      customEmojis = [...(draft?.customEmojis ?? [])];
      sensitive = Boolean(draft?.sensitive);
      warningReason = draft?.contentWarningReason ?? '';
    }
    uploadSettings = settings;
    availableCustomEmojis = sourceEmoji;
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
    confirmedRelays = '';
    message = '';
    await flushDraft();
    const result = await publishTweet(
      tweetPublishContent(content, attachments),
      props.relaySets,
      tweetPublishTags({
        content,
        attachments,
        customEmojis,
        sensitive,
        warningReason,
      }),
    );
    publishing = false;
    if (!result.ok) {
      message = result.message;
      return;
    }
    const accepted = result.results.filter((item) => item.accepted).length;
    confirmedRelays = `${accepted}/${result.results.length}`;
    message = `Sent to ${confirmedRelays} relays.`;
    content = '';
    attachments = [];
    customEmojis = [];
    sensitive = false;
    warningReason = '';
    await Promise.all([clearTweetDraft(draftId), clearTweetDraft('main')]);
    await tick();
    focusNonce += 1;
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

  function removeAttachment(url: string): void {
    attachments = attachments.filter((item) => item.url !== url);
    snapshot();
    void flushDraft();
  }

  function addCustomEmoji(emoji: CustomEmoji): void {
    customEmojis = upsertCustomEmoji(customEmojis, emoji);
  }
</script>

<section class="data-tab" aria-label="Tweet">
  <!-- prettier-ignore -->
  <TweetTabView tabId={props.tabId} bind:sensitive bind:warningReason bind:content {attachments} customEmojis={[...availableCustomEmojis, ...customEmojis]} {uploading} {publishing} {hasSigner} {uploadSettings} {canPublish} {message} {confirmedRelays} {focusNonce} {touchDraft} {flushDraft} {uploadFiles} {publish} {removeAttachment} {handlePaste} addCustomEmoji={addCustomEmoji} />
</section>
