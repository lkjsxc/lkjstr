<script lang="ts">
  import { Heart, ThumbsDown } from '@lucide/svelte';
  import EmojifiedText from './EmojifiedText.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import {
    openReactionSummaryActor,
    planReactionSummary,
    toggleReactionSummary,
    type ReactionActorPlan,
  } from './reaction-summary-plan';
  import ReactionSummaryActorRow from './ReactionSummaryActorRow.svelte';
  import type {
    ReactionGroup,
    RepostGroup,
  } from '$lib/thread/thread-reactions';

  type Props = {
    reactions?: readonly ReactionGroup[];
    reposts?: RepostGroup;
    profiles?: Record<string, ProfileSummary>;
    activeAccountPubkey?: string | null;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();
  let expanded = $state('');
  let plan = $derived(
    planReactionSummary({
      reactions: props.reactions,
      reposts: props.reposts,
      profiles: props.profiles,
      activeAccountPubkey: props.activeAccountPubkey,
      openProfile: props.openProfile,
      expanded,
    }),
  );

  function openActor(actor: ReactionActorPlan): void {
    openReactionSummaryActor(props.openProfile, actor);
  }

  function toggle(id: string): void {
    expanded = toggleReactionSummary(expanded, id);
  }
</script>

{#snippet actorRows(actors: readonly ReactionActorPlan[])}
  {#each actors as actor (actor.pubkey)}
    <ReactionSummaryActorRow {actor} {openActor} />
  {/each}
{/snippet}

{#if plan.reactions.length > 0}
  <ul class="reaction-summary" aria-label={plan.reactionsLabel}>
    {#each plan.reactions as reaction (reaction.key)}
      <li>
        <button
          type="button"
          class="reaction-summary__trigger"
          class:reaction-summary__own={reaction.own}
          aria-label={reaction.toggleLabel}
          aria-expanded={reaction.expanded}
          aria-controls={reaction.id}
          onclick={() => toggle(reaction.id)}
        >
          <span>
            {#if reaction.icon === 'like'}
              <Heart
                size={14}
                fill="currentColor"
                aria-label={reaction.label}
              />
            {:else if reaction.icon === 'dislike'}
              <ThumbsDown size={14} aria-label={reaction.label} />
            {:else}
              <EmojifiedText
                text={reaction.content}
                emojis={reaction.emoji ? [reaction.emoji] : []}
              />
            {/if}
          </span>
          <span class="sr-only">{reaction.label}</span>
          <strong>{reaction.countText}</strong>
        </button>
        {#if reaction.expanded}
          <div class="reaction-summary__actors" id={reaction.id}>
            {@render actorRows(reaction.actors)}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
{#if plan.reposts.visible}
  <div class="reaction-summary repost-summary">
    <button
      type="button"
      class="reaction-summary__trigger"
      aria-label={plan.reposts.toggleLabel}
      aria-expanded={plan.reposts.expanded}
      aria-controls={plan.reposts.id}
      onclick={() => toggle(plan.reposts.id)}
    >
      <span>{plan.reposts.label}</span>
      <strong>{plan.reposts.countText}</strong>
    </button>
    {#if plan.reposts.expanded}
      <div class="reaction-summary__actors" id={plan.reposts.id}>
        {@render actorRows(plan.reposts.actors)}
      </div>
    {/if}
  </div>
{/if}
