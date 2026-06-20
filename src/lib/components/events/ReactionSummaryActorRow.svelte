<script lang="ts">
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import EmojifiedText from './EmojifiedText.svelte';
  import type { ReactionActorPlan } from './reaction-summary-plan';

  type Props = {
    actor: ReactionActorPlan;
    openActor: (actor: ReactionActorPlan) => void;
  };

  let props: Props = $props();

  function openRowActor(): void {
    props.openActor(props.actor);
  }
</script>

{#snippet actorBody()}
  <Avatar
    pubkey={props.actor.pubkey}
    name={props.actor.name}
    src={props.actor.avatarUrl}
    size="sm"
  />
  <span>
    <EmojifiedText text={props.actor.name} emojis={props.actor.emojis} />
  </span>
{/snippet}

{#if props.actor.canOpen}
  <button type="button" onclick={openRowActor}>
    {@render actorBody()}
  </button>
{:else}
  <span class="reaction-summary__actor">
    {@render actorBody()}
  </span>
{/if}
