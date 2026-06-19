<script lang="ts">
  import type { ProfileSummary } from '$lib/identity/identity';
  import {
    eventProfileCanOpen,
    stopAndOpenEventProfile,
  } from './event-profile-activation';
  import EmojifiedText from './EmojifiedText.svelte';

  type Props = {
    pubkey: string;
    text: string;
    rawText: string;
    profile?: ProfileSummary;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();
  let canOpenProfile = $derived(eventProfileCanOpen(props.openProfile));

  function open(event: MouseEvent): void {
    stopAndOpenEventProfile(event, props.openProfile, props.pubkey);
  }
</script>

{#if canOpenProfile}
  <button
    type="button"
    class="content-token content-mention-token"
    title={props.rawText}
    onclick={open}
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
