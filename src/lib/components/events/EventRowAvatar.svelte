<script lang="ts">
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import EventMeta from './EventMeta.svelte';
  import { stopAndOpenEventProfile } from './event-profile-activation';
  import type { EventRowPresentationPlan } from './event-row-presentation-plan';

  type Props = {
    event: NostrEvent;
    profile?: ProfileSummary;
    presentation: EventRowPresentationPlan['profile'];
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();

  function openProfile(event: MouseEvent): void {
    stopAndOpenEventProfile(event, props.openProfile, props.event.pubkey);
  }
</script>

{#snippet avatarBody()}
  <EventMeta
    event={props.event}
    relays={[]}
    profile={props.profile}
    avatarOnly
  />
{/snippet}

{#if props.presentation.openable}
  <button
    type="button"
    class="avatar-button"
    aria-label={props.presentation.label}
    onclick={openProfile}
  >
    {@render avatarBody()}
  </button>
{:else}
  <span class="avatar-button">
    {@render avatarBody()}
  </span>
{/if}
