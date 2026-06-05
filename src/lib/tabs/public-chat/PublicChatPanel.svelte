<script lang="ts">
  import type {
    PublicChatChannel,
    PublicChatMessage,
    PublicChatState,
  } from '$lib/public-chat/public-chat-types';
  import PublicChatChannelDetail from './PublicChatChannelDetail.svelte';
  import PublicChatChannelList from './PublicChatChannelList.svelte';
  import PublicChatComposer from './PublicChatComposer.svelte';
  import PublicChatMessageList from './PublicChatMessageList.svelte';

  type Props = {
    state: PublicChatState;
    activePubkey?: string;
    metadataName: string;
    metadataAbout: string;
    active: boolean;
    canWrite: boolean;
    draft: string;
    replyTo?: PublicChatMessage;
    openChannel: (channel: PublicChatChannel) => void;
    setMetadataName: (value: string) => void;
    setMetadataAbout: (value: string) => void;
    editMetadata: () => void;
    setReply: (message: PublicChatMessage) => void;
    hideMessage: (message: PublicChatMessage) => void;
    muteUser: (message: PublicChatMessage) => void;
    setDraft: (value: string) => void;
    sendMessage: () => void;
  };

  let props: Props = $props();
  let selectedChannel = $derived(
    props.state.channels.find(
      (channel) => channel.id === props.state.selectedChannelId,
    ),
  );
  let canEditMetadata = $derived(
    Boolean(
      selectedChannel && props.activePubkey === selectedChannel.creatorPubkey,
    ),
  );
</script>

<div class="public-chat-layout">
  <PublicChatChannelList
    channels={props.state.channels}
    selectedChannelId={props.state.selectedChannelId}
    openChannel={props.openChannel}
  />
  <section aria-label="Selected channel messages">
    <PublicChatChannelDetail
      {selectedChannel}
      {canEditMetadata}
      metadataName={props.metadataName}
      metadataAbout={props.metadataAbout}
      setMetadataName={props.setMetadataName}
      setMetadataAbout={props.setMetadataAbout}
      editMetadata={props.editMetadata}
    />
    <PublicChatMessageList
      messages={props.state.messages}
      setReply={props.setReply}
      hideMessage={props.hideMessage}
      muteUser={props.muteUser}
    />
    <PublicChatComposer
      {selectedChannel}
      active={props.active}
      canWrite={props.canWrite}
      draft={props.draft}
      replyTo={props.replyTo}
      setDraft={props.setDraft}
      sendMessage={props.sendMessage}
    />
  </section>
</div>
