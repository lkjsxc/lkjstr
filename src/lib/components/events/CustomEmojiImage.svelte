<script lang="ts">
  import type { CustomEmoji } from '$lib/protocol';

  type Props = {
    emoji: CustomEmoji;
  };

  let props: Props = $props();
</script>

<img
  class="custom-emoji"
  src={props.emoji.url}
  alt={`:${props.emoji.shortcode}:`}
  loading="lazy"
  decoding="async"
  referrerpolicy="no-referrer"
/>
