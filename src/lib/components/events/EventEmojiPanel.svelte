<script lang="ts">
  import EmojiPopover from '$lib/components/emoji/EmojiPopover.svelte';
  import { customEmojiReactionContent, type CustomEmoji } from '$lib/protocol';

  type EmojiReaction = {
    readonly content: string;
    readonly emoji?: CustomEmoji;
  };

  type Props = {
    busy: boolean;
    customEmojis?: readonly CustomEmoji[];
    publish: (reaction: EmojiReaction) => void;
  };

  let props: Props = $props();

  function publishCustom(emoji: CustomEmoji): void {
    props.publish({ content: customEmojiReactionContent(emoji), emoji });
  }
</script>

<div class="event-inline-action event-inline-action--emoji">
  <EmojiPopover
    customEmojis={props.customEmojis}
    onUnicode={(emoji) => props.publish({ content: emoji })}
    onCustom={publishCustom}
    close={() => undefined}
  />
</div>
