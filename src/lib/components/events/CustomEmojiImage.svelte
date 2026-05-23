<script lang="ts">
  import type { CustomEmoji } from '$lib/protocol';

  type Props = {
    emoji: CustomEmoji;
  };

  let props: Props = $props();
  let failed = $state(false);
</script>

{#if failed}
  <span class="custom-emoji-fallback">:{props.emoji.shortcode}:</span>
{:else}
  <img
    class="custom-emoji"
    src={props.emoji.url}
    alt={`:${props.emoji.shortcode}:`}
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    onerror={() => (failed = true)}
  />
{/if}
