<script lang="ts">
  import type { CustomEmoji } from '$lib/protocol';
  import CustomEmojiImage from './CustomEmojiImage.svelte';
  import { planEmojifiedText } from './emojified-text-plan';

  type Props = {
    text: string;
    emojis?: readonly CustomEmoji[];
  };

  let props: Props = $props();
  let tokens = $derived(planEmojifiedText(props.text, props.emojis));
</script>

{#each tokens as item (item.key)}
  {#if item.token.type === 'custom-emoji'}
    <CustomEmojiImage emoji={item.token} />
  {:else}
    {item.token.text}
  {/if}
{/each}
