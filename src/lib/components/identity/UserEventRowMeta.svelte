<script lang="ts">
  import EmojifiedText from '$lib/components/events/EmojifiedText.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { userEventRowView, type UserEventRowContext } from './user-event-row';

  type Props = {
    pubkey: string;
    profile?: ProfileSummary;
    context?: UserEventRowContext;
    compact?: boolean;
  };

  let props: Props = $props();
  let view = $derived(
    userEventRowView({
      pubkey: props.pubkey,
      profile: props.profile,
      context: props.context,
    }),
  );
</script>

<div class="user-event-row__meta">
  <strong class="user-event-row__title">
    <EmojifiedText
      text={view.title}
      emojis={props.profile?.customEmojis ?? []}
    />
    {#if view.verifiedNip05}<span aria-label="verified NIP-05">verified</span>{/if}
  </strong>
  {#if !props.compact && view.subtitle}
    <span class="user-event-row__subtitle">{view.subtitle}</span>
  {/if}
  {#if !props.compact && view.chips.length > 0}
    <span class="user-event-row__chips">
      {#each view.chips as chip}<small>{chip}</small>{/each}
    </span>
  {/if}
</div>
