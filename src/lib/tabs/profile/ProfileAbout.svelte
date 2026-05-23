<script lang="ts">
  import CustomEmojiImage from '$lib/components/events/CustomEmojiImage.svelte';
  import { tokenizeProfileText } from '$lib/profile/profile-links';
  import type { CustomEmoji } from '$lib/protocol';

  type Props = {
    text: string;
    emojis?: readonly CustomEmoji[];
  };

  let props: Props = $props();
  let tokens = $derived(tokenizeProfileText(props.text, props.emojis ?? []));
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<p>
  {#each tokens as token, index (`${index}:${token.type}`)}
    {#if token.type === 'url'}
      <a href={token.href} target="_blank" rel="noopener noreferrer">
        {token.text}
      </a>
    {:else if token.type === 'custom-emoji'}
      <CustomEmojiImage emoji={token} />
    {:else}
      {token.text}
    {/if}
  {/each}
</p>
