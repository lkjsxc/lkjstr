<script lang="ts">
  import IdentityChip from './IdentityChip.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';

  type Props = {
    pubkey: string;
    profile?: ProfileSummary;
  };

  let { pubkey, profile }: Props = $props();
</script>

<aside class="hover-card">
  <IdentityChip {pubkey} {profile} />
  {#if profile?.about}
    <p>{profile.about}</p>
  {/if}
</aside>
