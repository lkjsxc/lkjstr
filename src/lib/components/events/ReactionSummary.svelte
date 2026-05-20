<script lang="ts">
  import type { ReactionGroup } from '$lib/thread/thread-reactions';

  type Props = {
    reactions?: readonly ReactionGroup[];
  };

  let props: Props = $props();
</script>

{#if props.reactions && props.reactions.length > 0}
  <ul class="reaction-summary" aria-label="Reactions">
    {#each props.reactions as reaction (reaction.content)}
      <li title={reaction.actors.join(', ')}>
        <span>{reaction.content}</span>
        <strong>{reaction.count}</strong>
      </li>
    {/each}
  </ul>
{/if}
