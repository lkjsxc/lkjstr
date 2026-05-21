<script lang="ts">
  import { tokenizeText } from '$lib/events/content-tokens';
  import type { CustomEmoji } from '$lib/protocol';

  type Props = {
    text: string;
    emojis?: readonly CustomEmoji[];
  };

  let props: Props = $props();
  let tokens = $derived(tokenizeText(props.text, new Set(), props.emojis));
</script>

{#each tokens as token, index (`${index}:${token.type}`)}
  {#if token.type === 'custom-emoji'}
    <img class="custom-emoji" src={token.url} alt={token.text} />
  {:else}
    {token.text}
  {/if}
{/each}
