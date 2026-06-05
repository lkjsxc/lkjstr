<script lang="ts">
  import type { PublicChatChannel } from '$lib/public-chat/public-chat-types';

  type Props = {
    selectedChannel?: PublicChatChannel;
    canEditMetadata: boolean;
    metadataName: string;
    metadataAbout: string;
    setMetadataName: (value: string) => void;
    setMetadataAbout: (value: string) => void;
    editMetadata: () => void;
  };

  let props: Props = $props();
</script>

{#if props.selectedChannel}
  <h3>
    {props.selectedChannel.metadata.name ?? 'Channel metadata unavailable'}
  </h3>
  <p>
    {props.selectedChannel.metadata.about ?? 'No about metadata available.'}
  </p>
  {#if props.canEditMetadata}
    <input
      value={props.metadataName}
      oninput={(event) => props.setMetadataName(event.currentTarget.value)}
      aria-label="Channel name"
    />
    <textarea
      value={props.metadataAbout}
      oninput={(event) => props.setMetadataAbout(event.currentTarget.value)}
      aria-label="Channel about"
    ></textarea>
    <button type="button" onclick={props.editMetadata}
      >Publish metadata edit</button
    >
  {/if}
{/if}
