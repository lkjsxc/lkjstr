<script lang="ts">
  import { avatarColor, initials } from '$lib/identity/avatar';

  type Props = {
    pubkey: string;
    name: string;
    src?: string | null;
    size?: 'sm' | 'md' | 'lg';
  };

  let { pubkey, name, src = null, size = 'md' }: Props = $props();
  let failedSrc = $state<string | null>(null);
  let visibleSrc = $derived(src && src !== failedSrc ? src : null);

  function fail(): void {
    failedSrc = src;
  }
</script>

{#if visibleSrc}
  <img
    class={`avatar ${size}`}
    src={visibleSrc}
    alt=""
    loading="lazy"
    decoding="async"
    onerror={fail}
  />
{:else}
  <span
    class={`avatar fallback ${size}`}
    style={`background: ${avatarColor(pubkey)}`}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
{/if}
