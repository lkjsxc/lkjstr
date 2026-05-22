<script lang="ts">
  import { Smile } from '@lucide/svelte';
  import type { CustomEmoji } from '$lib/protocol';
  import AnchoredPopover from '$lib/components/popover/AnchoredPopover.svelte';
  import EmojiPopover from './EmojiPopover.svelte';

  type Props = {
    customEmojis?: readonly CustomEmoji[];
    disabled?: boolean;
    onUnicode: (emoji: string) => void;
    onCustom: (emoji: CustomEmoji) => void;
  };

  let props: Props = $props();
  let open = $state(false);
  let anchor: HTMLElement | undefined = $state();
</script>

<span class="emoji-palette-anchor">
  <button
    bind:this={anchor}
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
  {#if open && anchor}
    <AnchoredPopover
      {anchor}
      label="Emoji palette"
      preferred="bottom-start"
      close={() => (open = false)}
    >
      <EmojiPopover
        customEmojis={props.customEmojis}
        onUnicode={props.onUnicode}
        onCustom={props.onCustom}
        close={() => (open = false)}
      />
    </AnchoredPopover>
  {/if}
</span>
