<script lang="ts">
  import type { ResolvedReference } from '$lib/events/reference-resolver';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EventReferenceCard from './EventReferenceCard.svelte';
  import {
    planEventReferenceList,
    toggleEventReferenceList,
  } from './event-reference-list-plan';

  type Props = {
    references: readonly ResolvedReference[];
    profiles: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let expanded = $state(false);
  let plan = $derived(planEventReferenceList(props.references, expanded));
</script>

{#each plan.visible as reference (`${reference.kind}:${reference.id}`)}
  <EventReferenceCard
    {reference}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/each}
{#if plan.canToggle}
  <button
    class="content-token"
    type="button"
    onclick={(event) => (expanded = toggleEventReferenceList(event, expanded))}
  >
    {plan.toggleLabel}
  </button>
{/if}
