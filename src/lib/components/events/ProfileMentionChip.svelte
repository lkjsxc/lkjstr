<script lang="ts">
  import type { ProfileSummary } from '$lib/identity/identity';
  import { stopAndOpenEventProfile } from './event-profile-activation';
  import EmojifiedText from './EmojifiedText.svelte';
  import { planProfileMentionChip } from './profile-mention-chip-plan';

  type Props = {
    pubkey: string;
    text: string;
    rawText: string;
    profile?: ProfileSummary;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();
  let plan = $derived(
    planProfileMentionChip({
      text: props.text,
      rawText: props.rawText,
      profile: props.profile,
      openProfile: props.openProfile,
    }),
  );

  function open(event: MouseEvent): void {
    stopAndOpenEventProfile(event, props.openProfile, props.pubkey);
  }
</script>

{#snippet chipBody()}
  <EmojifiedText text={plan.text} emojis={plan.emojis} />
{/snippet}

{#if plan.canOpenProfile}
  <button
    type="button"
    class="content-token content-mention-token"
    title={plan.title}
    onclick={open}
  >
    {@render chipBody()}
  </button>
{:else}
  <span class="content-token content-mention-token" title={plan.title}>
    {@render chipBody()}
  </span>
{/if}
