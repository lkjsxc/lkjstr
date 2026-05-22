<script lang="ts">
  import type { ResolvedReference } from '$lib/events/reference-resolver';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EventReferenceCard from './EventReferenceCard.svelte';

  type Props = {
    references: readonly ResolvedReference[];
    profiles: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let expanded = $state(false);
  let visible = $derived(
    expanded ? props.references : props.references.slice(0, 3),
  );
</script>

{#each visible as reference (`${reference.kind}:${reference.id}`)}
  <EventReferenceCard
    {reference}
    profiles={props.profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/each}
{#if props.references.length > 3}
  <button
    class="content-token"
    type="button"
    onclick={(event) => {
      event.stopPropagation();
      expanded = !expanded;
    }}
  >
    {expanded
      ? 'Hide references'
      : `Show all references (${props.references.length})`}
  </button>
{/if}
