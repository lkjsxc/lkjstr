<script lang="ts">
  import type { TweetAttachment } from '$lib/tweet/draft-store';

  type Props = {
    attachments: readonly TweetAttachment[];
    remove: (url: string) => void;
  };

  let props: Props = $props();
</script>

{#if props.attachments.length > 0}
  <ul class="tweet-attachments" aria-label="Uploaded media">
    {#each props.attachments as attachment (attachment.url)}
      <li>
        <button
          type="button"
          onclick={() => window.open(attachment.url, '_blank')}
        >
          {attachment.name || attachment.url}
        </button>
        <button type="button" onclick={() => props.remove(attachment.url)}>
          Remove
        </button>
      </li>
    {/each}
  </ul>
{/if}
