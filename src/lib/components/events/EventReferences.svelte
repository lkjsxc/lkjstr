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

  type Props = {
    references: readonly EventReference[];
    relays?: readonly string[];
    depth?: number;
    profiles?: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let resolved = $state<ResolvedReference[]>([]);
  let profiles = $state<Record<string, ProfileSummary>>({});
  let loaded = $state(false);

  onMount(() => {
    let alive = true;
    void load();
    return () => {
      alive = false;
    };

    async function load(): Promise<void> {
      const next = await resolveReferences({
        references: props.references,
        relays: props.relays ?? [],
        key: `refs:${props.references.length}:${props.references[0]?.id.slice(0, 12)}`,
      });
      if (!alive) return;
      resolved = next;
      const authors = [
        ...new Set(next.flatMap((item) => item.event?.event.pubkey ?? [])),
      ].filter((pubkey) => !props.profiles?.[pubkey]);
      const hydrated = await hydrateProfiles({
        pubkeys: authors,
        relays: props.relays ?? [],
        subId: 'event-references',
      });
      if (!alive) return;
      profiles = { ...(props.profiles ?? {}), ...hydrated };
      loaded = true;
    }
  });
</script>

{#if !loaded && props.references.length > 0}
  <p class="event-list__status">Loading referenced events...</p>
{/if}
{#if loaded}
  <EventReferenceList
    references={resolved}
    {profiles}
    openProfile={props.openProfile}
    openThread={props.openThread}
  />
{/if}
