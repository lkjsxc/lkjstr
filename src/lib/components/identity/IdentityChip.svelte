<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { identityDisplay, type ProfileSummary } from '$lib/identity/identity';

  type Props = {
    pubkey: string;
    profile?: ProfileSummary;
    compact?: boolean;
  };

  let { pubkey, profile, compact = false }: Props = $props();
  let display = $derived(identityDisplay(pubkey, profile));
</script>

<span class:compact class="identity-chip">
  <Avatar
    pubkey={display.pubkey}
    name={display.title}
    src={display.avatarUrl}
  />
  <span>
    <strong>{display.title}</strong>
    {#if !compact}
      <small>{display.subtitle}{display.stale ? ' stale' : ''}</small>
    {/if}
  </span>
</span>
