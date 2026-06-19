<script lang="ts">
  import type { CustomEmoji } from '$lib/protocol';
  import { planCustomEmojiImage } from './custom-emoji-image-plan';

  type Props = {
    emoji: CustomEmoji;
  };

  let props: Props = $props();
  let failed = $state(false);
  let plan = $derived(planCustomEmojiImage(props.emoji));
</script>

{#if failed}
  <span class="custom-emoji-fallback">{plan.fallbackText}</span>
{:else}
  <img
    class="custom-emoji"
    src={plan.src}
    alt={plan.alt}
    loading={plan.loading}
    decoding={plan.decoding}
    referrerpolicy={plan.referrerPolicy}
    onerror={() => (failed = true)}
  />
{/if}
