<script lang="ts">
  import { onMount } from 'svelte';
  import { resolveReferences } from '$lib/events/reference-resolver';
  import { hydrateProfiles } from '$lib/identity/profile-hydration';
  import type { ProfileSummary } from '$lib/identity/identity';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import {
    eventMentionHydrationPlan,
    eventMentionLoadedPlan,
    openEventMentionThread,
    planEventMentionChip,
  } from './event-mention-chip-plan';

  type Props = {
    eventId: string;
    rawText: string;
    relays?: readonly string[];
    fallbackRelays?: readonly string[];
    profiles?: Record<string, ProfileSummary>;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let profile = $state<ProfileSummary | undefined>();
  let excerpt = $state('');
  let plan = $derived(
    planEventMentionChip({
      eventId: props.eventId,
      rawText: props.rawText,
      relays: props.relays,
      fallbackRelays: props.fallbackRelays,
      openThread: props.openThread,
    }),
  );

  onMount(async () => {
    const [resolved] = await resolveReferences({
      references: [plan.reference],
      relays: plan.relays,
      key: plan.resolverKey,
    });
    const event = resolved?.event?.event;
    if (!event) return;
    const hydration = eventMentionHydrationPlan(event, props.profiles);
    const hydrated = hydration.profile
      ? {}
      : await hydrateProfiles({
          pubkeys: hydration.pubkeys,
          relays: plan.relays,
          owner: 'event-mention',
        });
    const loaded = eventMentionLoadedPlan(event, props.profiles, hydrated);
    excerpt = loaded.excerpt;
    profile = loaded.profile;
  });

  function open(event: MouseEvent): void {
    openEventMentionThread(event, props.openThread, props.eventId);
  }
</script>

{#snippet chipBody()}
  <span>{plan.label}</span>
  {#if profile}
    <IdentityChip pubkey={profile.pubkey} {profile} compact />
  {/if}
  {#if excerpt}<small>{excerpt}</small>{/if}
{/snippet}

{#if plan.canOpenThread}
  <button
    type="button"
    class="content-token content-mention-token event-mention-chip"
    title={plan.title}
    onclick={open}
  >
    {@render chipBody()}
  </button>
{:else}
  <span
    class="content-token content-mention-token event-mention-chip"
    title={plan.title}
  >
    {@render chipBody()}
  </span>
{/if}
