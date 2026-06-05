<script lang="ts">
  import type { PublicChatChannel } from '$lib/public-chat/public-chat-types';

  type Props = {
    channels: readonly PublicChatChannel[];
    selectedChannelId?: string;
    openChannel: (channel: PublicChatChannel) => void;
  };

  let { channels, selectedChannelId, openChannel }: Props = $props();
</script>

<nav aria-label="Public Chat channels">
  {#each channels as channel (channel.id)}
    <button
      type="button"
      onclick={() => openChannel(channel)}
      aria-current={channel.id === selectedChannelId}
    >
      <strong>{channel.metadata.name ?? 'Channel metadata unavailable'}</strong>
      <small>{channel.id}</small>
    </button>
  {/each}
</nav>
