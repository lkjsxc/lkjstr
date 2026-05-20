<script lang="ts">
  import { onMount } from 'svelte';

  type EmojiReaction = {
    readonly content: string;
    readonly emoji?: { shortcode: string; url: string };
  };

  type Props = {
    busy: boolean;
    publish: (reaction: EmojiReaction) => void;
  };

  let props: Props = $props();
  let emoji = $state('');
  let picker: HTMLElement | undefined = $state();
  const pickerTag = 'emoji-picker';

  onMount(() => {
    void import('emoji-picker-element');
    if (!picker) return;
    const choose = (event: Event) => {
      const detail = (event as CustomEvent<{ unicode?: string }>).detail;
      if (detail?.unicode) emoji = detail.unicode;
    };
    picker.addEventListener('emoji-click', choose);
    return () => picker?.removeEventListener('emoji-click', choose);
  });

  function submit(): void {
    const parsed = customEmoji(emoji.trim());
    props.publish(parsed ?? { content: emoji.trim() });
  }

  function customEmoji(value: string): EmojiReaction | undefined {
    const match = /^:([^:]+):(https:\/\/\S+)$/.exec(value);
    return match
      ? {
          content: `:${match[1]}:`,
          emoji: { shortcode: match[1], url: match[2] },
        }
      : undefined;
  }
</script>

<form
  class="event-inline-action event-inline-action--emoji"
  onsubmit={(event) => {
    event.preventDefault();
    submit();
  }}
>
  <input
    aria-label="Emoji reaction"
    bind:value={emoji}
    placeholder="emoji or :shortcode:https://..."
  />
  <button
    class="compact-button"
    type="submit"
    disabled={props.busy || !emoji.trim()}
  >
    React
  </button>
  <svelte:element this={pickerTag} bind:this={picker} />
</form>
