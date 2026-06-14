<script lang="ts">
  import { onMount } from 'svelte';
  import { resolveReferences } from '$lib/events/reference-resolver';
  import { hydrateProfiles } from '$lib/identity/profile-hydration';
  import type { ProfileSummary } from '$lib/identity/identity';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { EventReference } from '$lib/protocol';
  import { hasOpenThreadAction } from './action-availability';

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
  let label = $derived(`event:${props.eventId.slice(0, 8)}`);
  let canOpenThread = $derived(hasOpenThreadAction(props.openThread));

  onMount(async () => {
    const relays = [
      ...new Set([...(props.relays ?? []), ...(props.fallbackRelays ?? [])]),
    ];
    const reference: EventReference = {
      kind: 'nostr-event',
      id: props.eventId,
      relays: props.relays ?? [],
    };
    const [resolved] = await resolveReferences({
      references: [reference],
      relays,
      key: `mention:${props.eventId.slice(0, 12)}`,
    });
    const event = resolved?.event?.event;
    if (!event) return;
    excerpt = event.content.trim().replace(/\s+/gu, ' ').slice(0, 96);
    profile =
      props.profiles?.[event.pubkey] ??
      (
        await hydrateProfiles({
          pubkeys: [event.pubkey],
          relays,
          owner: 'event-mention',
        })
      )[event.pubkey];
  });

  function open(event: MouseEvent): void {
    event.stopPropagation();
    const openThread = props.openThread;
    if (!hasOpenThreadAction(openThread)) return;
    openThread(props.eventId);
  }
</script>

{#if canOpenThread}
  <button
    type="button"
    class="content-token content-mention-token event-mention-chip"
    title={props.rawText}
    onclick={open}
  >
    <span>{label}</span>
    {#if profile}
      <IdentityChip pubkey={profile.pubkey} {profile} compact />
    {/if}
    {#if excerpt}<small>{excerpt}</small>{/if}
  </button>
{:else}
  <span
    class="content-token content-mention-token event-mention-chip"
    title={props.rawText}
  >
    <span>{label}</span>
    {#if profile}
      <IdentityChip pubkey={profile.pubkey} {profile} compact />
    {/if}
    {#if excerpt}<small>{excerpt}</small>{/if}
  </span>
{/if}
