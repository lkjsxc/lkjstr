<script lang="ts" module>
  let pickerModule: Promise<unknown> | undefined;

  function loadEmojiPicker(): Promise<unknown> {
    pickerModule ??= import('emoji-picker-element');
    return pickerModule;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import type { CustomEmoji } from '$lib/protocol';
  import CustomEmojiImage from '$lib/components/events/CustomEmojiImage.svelte';

  type Props = {
    customEmojis?: readonly CustomEmoji[];
    onUnicode: (emoji: string) => void;
    onCustom: (emoji: CustomEmoji) => void;
    close: () => void;
  };

  let props: Props = $props();
  let picker: HTMLElement | undefined = $state();
  const pickerTag = 'emoji-picker';

  onMount(() => {
    void loadEmojiPicker();
    const choose = (event: Event) => {
      const detail = (event as CustomEvent<{ unicode?: string }>).detail;
      if (!detail?.unicode) return;
      props.onUnicode(detail.unicode);
      props.close();
    };
    picker?.addEventListener('emoji-click', choose);
    return () => picker?.removeEventListener('emoji-click', choose);
  });
</script>

<div class="emoji-popover" role="dialog" aria-label="Emoji palette">
  {#if props.customEmojis && props.customEmojis.length > 0}
    <div class="emoji-popover__custom" aria-label="Custom emoji">
      {#each props.customEmojis as emoji (`${emoji.shortcode}:${emoji.url}:${emoji.address ?? ''}`)}
        <button
          type="button"
          class="icon-button"
          title={`:${emoji.shortcode}:`}
          onclick={() => {
            props.onCustom(emoji);
            props.close();
          }}
        >
          <CustomEmojiImage {emoji} />
          <span class="sr-only">:{emoji.shortcode}:</span>
        </button>
      {/each}
    </div>
  {/if}
  <svelte:element this={pickerTag} bind:this={picker} />
</div>
