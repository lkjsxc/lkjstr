<script lang="ts">
  import Avatar from '$lib/components/identity/Avatar.svelte';
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
</script>

{#if props.reactions && props.reactions.length > 0}
  <ul class="reaction-summary" aria-label="Reactions">
    {#each props.reactions as reaction (reaction.content)}
      {@const id = `reaction-${reaction.content.codePointAt(0) ?? 0}`}
      <li>
        <button
          type="button"
          aria-expanded={expanded === id}
          aria-controls={id}
          onclick={() => toggle(id)}
        >
          <span>{reaction.content}</span>
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
                <span>{name(actor)}</span>
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
            <span>{name(actor)}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/if}
