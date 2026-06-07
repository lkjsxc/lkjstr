<script lang="ts">
  import FormTabShell from '$lib/components/workspace/FormTabShell.svelte';
  import { onDestroy, onMount } from 'svelte';
  import type { Account } from '$lib/accounts/account';
  import { publicChatReadRelays } from '$lib/public-chat/public-chat-filters';
  import { emptyPublicChatState } from '$lib/public-chat/public-chat-reducer';
  import { createPublicChatRuntime } from '$lib/public-chat/public-chat-runtime';
  import type {
    PublicChatChannel,
    PublicChatMessage,
    PublicChatState,
  } from '$lib/public-chat/public-chat-types';
  import { selectedUserWriteRelays } from '$lib/relays/relay-selection';
  import type { RelaySet } from '$lib/relays/relay-store';
  import PublicChatPanel from './PublicChatPanel.svelte';
  import PublicChatToolbar from './PublicChatToolbar.svelte';
  import {
    createChannelAction,
    editMetadataAction,
    hideMessageAction,
    muteUserAction,
    sendMessageAction,
    type PublicChatActionResult,
  } from './public-chat-tab-actions';

  type Props = {
    tabId: string;
    activeAccount?: Account;
    relaySets: RelaySet[];
  };

  let { activeAccount, relaySets }: Props = $props();
  let runtime: ReturnType<typeof createPublicChatRuntime> | undefined =
    $state();
  let chatState: PublicChatState = $state(emptyPublicChatState());
  let status = $state('Loading channels.');
  let loading = $state(false);
  let draft = $state('');
  let openId = $state('');
  let newChannelName = $state('');
  let metadataName = $state('');
  let metadataAbout = $state('');
  let replyTo: PublicChatMessage | undefined = $state();
  let readRelays = $derived(publicChatReadRelays(relaySets));
  let writeRelays = $derived(selectedUserWriteRelays(relaySets));
  let selectedChannel = $derived(
    chatState.channels.find(
      (channel) => channel.id === chatState.selectedChannelId,
    ),
  );

  onMount(() => {
    runtime = createPublicChatRuntime(relaySets);
    void refreshChannels();
  });
  onDestroy(() => runtime?.close());

  async function refreshChannels(): Promise<void> {
    if (!runtime) return;
    loading = true;
    status = readRelays.length
      ? 'Loading channels.'
      : 'No read relays selected.';
    const result = await runtime.discoverChannels();
    chatState = { ...result.state, channelCoverage: result.coverage };
    status = result.state.channels.length
      ? 'Channel list loaded.'
      : 'No channels found; relay coverage may be incomplete.';
    loading = false;
  }

  async function openChannel(channel: PublicChatChannel): Promise<void> {
    if (!runtime) return;
    metadataName = channel.metadata.name ?? '';
    metadataAbout = channel.metadata.about ?? '';
    loading = true;
    const result = await runtime.loadMessages(
      chatState,
      channel,
      activeAccount?.pubkey,
    );
    chatState = { ...result.state, messageCoverage: result.coverage };
    status = result.state.messages.length
      ? 'Messages loaded.'
      : 'No loaded messages; relay coverage may be incomplete.';
    loading = false;
  }

  async function openChannelById(): Promise<void> {
    if (!runtime || !openId.trim()) return;
    const result = await runtime.openChannelById(openId.trim());
    chatState = { ...chatState, channels: result.state.channels };
    status = result.state.channels.length
      ? 'Channel opened by event id.'
      : 'Channel metadata unavailable or not found with current relay coverage.';
  }

  async function createChannel(): Promise<void> {
    await applyAction(
      createChannelAction({
        relaySets,
        writeRelays,
        state: chatState,
        name: newChannelName,
      }),
    );
  }

  async function sendMessage(): Promise<void> {
    if (!selectedChannel || !draft.trim()) return;
    await applyAction(
      sendMessageAction({
        relaySets,
        writeRelays,
        state: chatState,
        channel: selectedChannel,
        draft,
        replyTo,
      }),
    );
  }

  async function editMetadata(): Promise<void> {
    if (
      !selectedChannel ||
      activeAccount?.pubkey !== selectedChannel.creatorPubkey
    )
      return;
    await applyAction(
      editMetadataAction({
        relaySets,
        writeRelays,
        state: chatState,
        channel: selectedChannel,
        name: metadataName,
        about: metadataAbout,
      }),
    );
  }

  async function hideMessage(message: PublicChatMessage): Promise<void> {
    await applyAction(
      hideMessageAction({ relaySets, writeRelays, state: chatState, message }),
    );
  }

  async function muteUser(message: PublicChatMessage): Promise<void> {
    await applyAction(
      muteUserAction({ relaySets, writeRelays, state: chatState, message }),
    );
  }

  async function applyAction(action: Promise<PublicChatActionResult>) {
    const result = await action;
    chatState = result.state;
    status = result.status;
    if (result.clearDraft) draft = '';
    if (result.clearReply) replyTo = undefined;
    if (result.clearNewChannelName) newChannelName = '';
    void result.deliveryStatus?.then((message) => {
      if (message) status = message;
    });
  }
</script>

<FormTabShell label="Public Chat" class="data-tab public-chat-tab">
  <PublicChatToolbar
    {status}
    {readRelays}
    {writeRelays}
    {loading}
    {openId}
    {newChannelName}
    setOpenId={(value) => (openId = value)}
    setNewChannelName={(value) => (newChannelName = value)}
    {refreshChannels}
    {openChannelById}
    {createChannel}
    canCreate={Boolean(activeAccount && writeRelays.length)}
  />
  <PublicChatPanel
    state={chatState}
    activePubkey={activeAccount?.pubkey}
    {metadataName}
    {metadataAbout}
    active={Boolean(activeAccount)}
    canWrite={writeRelays.length > 0}
    {draft}
    {replyTo}
    {openChannel}
    setMetadataName={(value) => (metadataName = value)}
    setMetadataAbout={(value) => (metadataAbout = value)}
    {editMetadata}
    setReply={(message) => (replyTo = message)}
    {hideMessage}
    {muteUser}
    setDraft={(value) => (draft = value)}
    {sendMessage}
  />
</FormTabShell>
