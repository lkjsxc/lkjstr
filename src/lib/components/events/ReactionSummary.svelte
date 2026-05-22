<script lang="ts">
  import { Heart, ThumbsDown } from '@lucide/svelte';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import EmojifiedText from './EmojifiedText.svelte';
  import { bestDisplayName } from '$lib/identity/display-name';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type {
    ReactionGroup,
    RepostGroup,
  } from '$lib/thread/thread-reactions';

  type Props = {
    reactions?: readonly ReactionGroup[];
    reposts?: RepostGroup;
    profiles?: Record<string, ProfileSummary>;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();
  let expanded = $state('');

  function toggle(id: string): void {
    expanded = expanded === id ? '' : id;
  }

  function name(pubkey: string): string {
    return bestDisplayName({ ...(props.profiles?.[pubkey] ?? {}), pubkey });
  }

  function reactionLabel(content: string): string {
    if (content === '+' || content === 'heart') return 'like';
    if (content === '-') return 'dislike';
    return content;
  }
</script>

{#if props.reactions && props.reactions.length > 0}
  <ul class="reaction-summary" aria-label="Reactions">
    {#each props.reactions as reaction (`${reaction.content}:${reaction.emoji?.url ?? ''}`)}
      {@const id = `reaction-${reaction.content}:${reaction.emoji?.url ?? ''}`}
      <li>
        <button
          type="button"
          aria-expanded={expanded === id}
          aria-controls={id}
          onclick={() => toggle(id)}
        >
          <span>
            {#if reaction.content === '+' || reaction.content === 'heart'}
              <Heart size={14} fill="currentColor" aria-label="like" />
            {:else if reaction.content === '-'}
              <ThumbsDown size={14} aria-label="dislike" />
            {:else}
              <EmojifiedText
                text={reaction.content}
                emojis={reaction.emoji ? [reaction.emoji] : []}
              />
            {/if}
          </span>
          <span class="sr-only">{reactionLabel(reaction.content)}</span>
          <strong>{reaction.count}</strong>
        </button>
        {#if expanded === id}
          <div class="reaction-summary__actors" {id}>
            {#each reaction.actors as actor (actor)}
              <button type="button" onclick={() => props.openProfile?.(actor)}>
                <Avatar
                  pubkey={actor}
                  name={name(actor)}
                  src={props.profiles?.[actor]?.avatarUrl}
                  size="sm"
                />
                <span>
                  <EmojifiedText
                    text={name(actor)}
                    emojis={props.profiles?.[actor]?.customEmojis ?? []}
                  />
                </span>
              </button>
            {/each}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
{#if props.reposts && props.reposts.count > 0}
  <div class="reaction-summary repost-summary">
    <button
      type="button"
      aria-expanded={expanded === 'reposts'}
      aria-controls="reposts"
      onclick={() => toggle('reposts')}
    >
      <span>repost</span>
      <strong>{props.reposts.count}</strong>
    </button>
    {#if expanded === 'reposts'}
      <div class="reaction-summary__actors" id="reposts">
        {#each props.reposts.actors as actor (actor)}
          <button type="button" onclick={() => props.openProfile?.(actor)}>
            <Avatar
              pubkey={actor}
              name={name(actor)}
              src={props.profiles?.[actor]?.avatarUrl}
              size="sm"
            />
            <span>
              <EmojifiedText
                text={name(actor)}
                emojis={props.profiles?.[actor]?.customEmojis ?? []}
              />
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
