<script lang="ts">
  import type { CustomEmoji } from '$lib/protocol';
  import { customEmojiTokenText, parseCustomEmojiInput } from '$lib/protocol';
  import CustomEmojiImage from '$lib/components/events/CustomEmojiImage.svelte';

  type Props = {
    inputId: string;
    customEmojis: readonly CustomEmoji[];
    add: (emoji: CustomEmoji) => void;
    remove: (shortcode: string) => void;
    touchDraft: () => void;
    flushDraft: () => Promise<void>;
  };

  let props: Props = $props();
  let value = $state('');
  let error = $state('');

  function submit(): void {
    const emoji = parseCustomEmojiInput(value);
    if (!emoji) {
      error = 'Use :shortcode:https://...';
      return;
    }
    props.add(emoji);
    props.touchDraft();
    void props.flushDraft();
    value = '';
    error = '';
  }
</script>

<form
  class="toolbar"
  onsubmit={(event) => {
    event.preventDefault();
    submit();
  }}
>
  <input
    aria-label="Custom emoji"
    bind:value
    id={props.inputId}
    name={props.inputId}
    placeholder=":shortcode:https://..."
  />
  <button type="submit" disabled={!value.trim()}>Attach emoji</button>
</form>
{#if error}<p role="status">{error}</p>{/if}
{#if props.customEmojis.length > 0}
  <div class="toolbar">
    {#each props.customEmojis as emoji (emoji.shortcode)}
      <button
        type="button"
        class="compact-button"
        title={customEmojiTokenText(emoji.shortcode)}
        onclick={() => props.remove(emoji.shortcode)}
      >
        <CustomEmojiImage {emoji} />
        {emoji.shortcode}
      </button>
    {/each}
  </div>
{/if}
