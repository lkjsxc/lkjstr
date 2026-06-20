<script lang="ts">
  import { onMount } from 'svelte';
  import {
    resolveReferences,
    type ResolvedReference,
  } from '$lib/events/reference-resolver';
  import { hydrateProfiles } from '$lib/identity/profile-hydration';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { EventReference } from '$lib/protocol';
  import EventReferenceList from './EventReferenceList.svelte';
  import {
    eventReferencesRenderPlan,
    loadEventReferences,
  } from './event-reference-hydration';

  type Props = {
    references: readonly EventReference[];
    relays?: readonly string[];
    depth?: number;
    profiles?: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let resolved = $state<readonly ResolvedReference[]>([]);
  let profiles = $state<Record<string, ProfileSummary>>({});
  let loaded = $state(false);
  let render = $derived(
    eventReferencesRenderPlan({
      loaded,
      referenceCount: props.references.length,
    }),
  );

  onMount(() => {
    let alive = true;
    void loadEventReferences({
      references: props.references,
      relays: props.relays ?? [],
      profiles: props.profiles,
      callbacks: {
        resolveReferences,
        hydrateProfiles,
        isAlive: () => alive,
        apply: (plan) => {
          resolved = plan.resolved;
          profiles = plan.profiles;
          loaded = plan.loaded;
        },
      },
    });
    return () => {
      alive = false;
    };
  });
</script>

{#if render.showLoading}
  <p class="event-list__status">{render.loadingStatus}</p>
{/if}
{#if render.showReferences}
  <EventReferenceList
    references={resolved}
    {profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
