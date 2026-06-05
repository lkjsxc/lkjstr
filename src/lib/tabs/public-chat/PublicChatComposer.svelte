<script lang="ts">
  import type {
    PublicChatChannel,
    PublicChatMessage,
  } from '$lib/public-chat/public-chat-types';

  type Props = {
    selectedChannel?: PublicChatChannel;
    active: boolean;
    canWrite: boolean;
    draft: string;
    replyTo?: PublicChatMessage;
    setDraft: (value: string) => void;
    sendMessage: () => void;
  };

  let props: Props = $props();
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    props.sendMessage();
  }}
>
  {#if props.replyTo}<p>Replying to {props.replyTo.eventId}</p>{/if}
  <textarea
    value={props.draft}
    oninput={(event) => props.setDraft(event.currentTarget.value)}
    aria-label="Public Chat message"
  ></textarea>
  <button
    type="submit"
    disabled={!props.selectedChannel || !props.active || !props.canWrite}
    >Send</button
  >
</form>
