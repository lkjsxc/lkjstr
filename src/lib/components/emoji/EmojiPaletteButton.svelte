<script lang="ts">
  import { onMount } from 'svelte';
  import { Smile } from '@lucide/svelte';
  import type { CustomEmoji } from '$lib/protocol';
  import EmojiPopover from './EmojiPopover.svelte';

  type Props = {
    customEmojis?: readonly CustomEmoji[];
    disabled?: boolean;
    onUnicode: (emoji: string) => void;
    onCustom: (emoji: CustomEmoji) => void;
  };

  let props: Props = $props();
  let open = $state(false);
  let root: HTMLElement | undefined = $state();

  onMount(() => {
    const closeFromOutside = (event: PointerEvent) => {
      if (root?.contains(event.target as Node)) return;
      open = false;
    };
    const closeFromEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') open = false;
    };
    document.addEventListener('pointerdown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  });
</script>

<div class="emoji-palette-anchor" bind:this={root}>
  <button
    type="button"
    class="icon-button"
    title="Emoji"
    aria-expanded={open}
    disabled={props.disabled}
    onclick={() => (open = !open)}
  >
    <Smile size={16} />
    <span class="sr-only">Emoji</span>
  </button>
  {#if open}
    <EmojiPopover
      customEmojis={props.customEmojis}
      onUnicode={props.onUnicode}
      onCustom={props.onCustom}
      close={() => (open = false)}
    />
  {/if}
</div>
