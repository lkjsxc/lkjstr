<script lang="ts">
  import { Heart, ThumbsDown } from '@lucide/svelte';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import EmojifiedText from './EmojifiedText.svelte';
  import type { ProfileSummary } from '$lib/identity/identity';
  import { eventProfileCanOpen } from './event-profile-activation';
  import {
    openReactionSummaryActor,
    planReactionSummary,
    toggleReactionSummary,
  } from './reaction-summary-plan';
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
  let canOpenProfile = $derived(eventProfileCanOpen(props.openProfile));
  let plan = $derived(
    planReactionSummary({
      reactions: props.reactions,
      reposts: props.reposts,
      profiles: props.profiles,
      activeAccountPubkey: props.activeAccountPubkey,
      expanded,
    }),
  );

  function openActor(actor: string): void {
    openReactionSummaryActor(props.openProfile, { pubkey: actor });
  }

  function toggle(id: string): void {
    expanded = toggleReactionSummary(expanded, id);
  }
</script>

{#if plan.reactions.length > 0}
  <ul class="reaction-summary" aria-label={plan.reactionsLabel}>
    {#each plan.reactions as reaction (reaction.key)}
      <li>
        <button
          type="button"
          class="reaction-summary__trigger"
          class:reaction-summary__own={reaction.own}
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
          <strong>{reaction.count}</strong>
        </button>
        {#if reaction.expanded}
          <div class="reaction-summary__actors" id={reaction.id}>
            {#each reaction.actors as actor (actor.pubkey)}
              {#if canOpenProfile}
                <button type="button" onclick={() => openActor(actor.pubkey)}>
                  <Avatar
                    pubkey={actor.pubkey}
                    name={actor.name}
                    src={actor.avatarUrl}
                    size="sm"
                  />
                  <span
                    ><EmojifiedText
                      text={actor.name}
                      emojis={actor.emojis}
                    /></span
                  >
                </button>
              {:else}
                <span class="reaction-summary__actor">
                  <Avatar
                    pubkey={actor.pubkey}
                    name={actor.name}
                    src={actor.avatarUrl}
                    size="sm"
                  />
                  <span
                    ><EmojifiedText
                      text={actor.name}
                      emojis={actor.emojis}
                    /></span
                  >
                </span>
              {/if}
            {/each}
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
      aria-expanded={plan.reposts.expanded}
      aria-controls={plan.reposts.id}
      onclick={() => toggle(plan.reposts.id)}
    >
      <span>{plan.reposts.label}</span>
      <strong>{plan.reposts.count}</strong>
    </button>
    {#if plan.reposts.expanded}
      <div class="reaction-summary__actors" id={plan.reposts.id}>
        {#each plan.reposts.actors as actor (actor.pubkey)}
          {#if canOpenProfile}
            <button type="button" onclick={() => openActor(actor.pubkey)}>
              <Avatar
                pubkey={actor.pubkey}
                name={actor.name}
                src={actor.avatarUrl}
                size="sm"
              />
              <span
                ><EmojifiedText text={actor.name} emojis={actor.emojis} /></span
              >
            </button>
          {:else}
            <span class="reaction-summary__actor">
              <Avatar
                pubkey={actor.pubkey}
                name={actor.name}
                src={actor.avatarUrl}
                size="sm"
              />
              <span
                ><EmojifiedText text={actor.name} emojis={actor.emojis} /></span
              >
            </span>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}
