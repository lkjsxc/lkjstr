<script lang="ts">
  import { avatarColor, initials } from '$lib/identity/avatar';

  type Props = {
    pubkey: string;
    name: string;
    src?: string | null;
    size?: 'sm' | 'md' | 'lg';
  };

  let { pubkey, name, src = null, size = 'md' }: Props = $props();
</script>

{#if src}
  <img class={`avatar ${size}`} {src} alt="" />
{:else}
  <span
    class={`avatar fallback ${size}`}
    style={`background: ${avatarColor(pubkey)}`}
    aria-hidden="true"
  >
    {initials(name)}
  </span>
{/if}
