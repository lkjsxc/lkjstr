<script lang="ts">
  import type { NostrEvent } from '$lib/protocol';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { identityDisplay, type ProfileSummary } from '$lib/identity/identity';
  import EmojifiedText from './EmojifiedText.svelte';

  type Props = {
    event: NostrEvent;
    relays: readonly string[];
    profile?: ProfileSummary;
    avatarOnly?: boolean;
    avatarInline?: boolean;
    openProfile?: (pubkey: string) => void;
  };

  let props: Props = $props();
  let display = $derived(identityDisplay(props.event.pubkey, props.profile));
  let time = $derived(new Date(props.event.created_at * 1000).toLocaleString());

  function openProfile(event: MouseEvent): void {
    event.stopPropagation();
    props.openProfile?.(props.event.pubkey);
  }
</script>

{#if props.avatarOnly}
  <Avatar
    pubkey={display.pubkey}
    name={display.title}
    src={display.avatarUrl}
  />
{:else}
  <div class="event-meta">
    <button type="button" class="identity-button" onclick={openProfile}>
      {#if props.avatarInline}
        <Avatar
          pubkey={display.pubkey}
          name={display.title}
          src={display.avatarUrl}
          size="sm"
        />
      {/if}
      <strong>
        <EmojifiedText
          text={display.title}
          emojis={props.profile?.customEmojis ?? []}
        />
      </strong>
      <small>{display.subtitle}</small>
    </button>
    <span>{time}</span>
  </div>
{/if}
