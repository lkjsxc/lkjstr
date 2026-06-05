<script lang="ts">
  import type { PublicChatMessage } from '$lib/public-chat/public-chat-types';

  type Props = {
    messages: readonly PublicChatMessage[];
    setReply: (message: PublicChatMessage) => void;
    hideMessage: (message: PublicChatMessage) => void;
    muteUser: (message: PublicChatMessage) => void;
  };

  let { messages, setReply, hideMessage, muteUser }: Props = $props();
</script>

{#each messages as message (message.eventId)}
  <article class:hidden-row={message.hidden || message.mutedAuthor}>
    {#if message.hidden}
      <p>Hidden by signed event.</p>
    {:else if message.mutedAuthor}
      <p>Muted author.</p>
    {:else}
      <p>{message.content}</p>
    {/if}
    <small>
      {message.pubkey}
      {message.replyTo ? `reply to ${message.replyTo}` : ''}
    </small>
    <button type="button" onclick={() => setReply(message)}>Reply</button>
    <button type="button" onclick={() => hideMessage(message)}>Hide</button>
    <button type="button" onclick={() => muteUser(message)}>Mute user</button>
  </article>
{/each}
