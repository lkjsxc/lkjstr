<script lang="ts">
  import type { ProfileSummary } from '$lib/identity/identity';
  import { hasOpenProfileAction } from './action-availability';
  import EmojifiedText from './EmojifiedText.svelte';

  type Props = {
    pubkey: string;
    text: string;
    rawText: string;
    profile?: ProfileSummary;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();
  let canOpenProfile = $derived(hasOpenProfileAction(props.openProfile));
</script>

{#if canOpenProfile}
  <button
    type="button"
    class="content-token content-mention-token"
    title={props.rawText}
    onclick={(event) => {
      event.stopPropagation();
      props.openProfile?.(props.pubkey);
    }}
  >
    <EmojifiedText
      text={props.text}
      emojis={props.profile?.customEmojis ?? []}
    />
  </button>
{:else}
  <span class="content-token content-mention-token" title={props.rawText}>
    <EmojifiedText
      text={props.text}
      emojis={props.profile?.customEmojis ?? []}
    />
  </span>
{/if}
