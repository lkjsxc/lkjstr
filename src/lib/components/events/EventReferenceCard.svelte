<script lang="ts">
  import { customEmojis } from '$lib/protocol';
  import type { ResolvedReference } from '$lib/events/reference-resolver';
  import type { ProfileSummary } from '$lib/identity/identity';
  import EmojifiedText from './EmojifiedText.svelte';
  import EventMeta from './EventMeta.svelte';
  import {
    eventReferenceCardKeyOpensThread,
    openEventReferenceCardThread,
    planEventReferenceCard,
  } from './event-reference-card-plan';

  type Props = {
    reference: ResolvedReference;
    profiles: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let plan = $derived(
    planEventReferenceCard(props.reference, props.profiles, props.openThread),
  );

  function open(id: string, domEvent?: Event): void {
    openEventReferenceCardThread(plan, id, props.openThread, domEvent);
  }
</script>

{#snippet cardBody()}
  <strong class="sr-only">{plan.label}</strong>
  {#if plan.event}
    <EventMeta
      event={plan.event}
      relays={plan.relays}
      profile={plan.profile}
      openProfile={props.openProfile}
      avatarInline
    />
    {#if plan.preview}
      <p class="event-content">
        <EmojifiedText text={plan.preview} emojis={customEmojis(plan.event)} />
      </p>
    {/if}
    {#if plan.mediaLabel}<small>{plan.mediaLabel}</small>{/if}
  {:else}
    <p>{plan.unavailableText}</p>
  {/if}
{/snippet}

{#if plan.canOpenThread}
  <div
    class="event-embed"
    data-kind={props.reference.kind}
    role="button"
    tabindex="0"
    onclick={(event) => open(props.reference.id, event)}
    onkeydown={(event) =>
      eventReferenceCardKeyOpensThread(event.key) &&
      open(props.reference.id, event)}
  >
    {@render cardBody()}
  </div>
{:else}
  <div class="event-embed" data-kind={props.reference.kind}>
    {@render cardBody()}
  </div>
{/if}
