<script lang="ts">
  import type { NostrEvent } from '$lib/protocol';
  import { encodeNote } from '$lib/protocol/nip19';
  import Avatar from '$lib/components/identity/Avatar.svelte';
  import { identityDisplay, type ProfileSummary } from '$lib/identity/identity';

  type Props = {
    event: NostrEvent;
    relays: readonly string[];
    profile?: ProfileSummary;
    avatarOnly?: boolean;
    fullEventId?: boolean;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let display = $derived(identityDisplay(props.event.pubkey, props.profile));
  let eventId = $derived(
    props.fullEventId ? fullNote(props.event.id) : short(props.event.id),
  );
  let time = $derived(new Date(props.event.created_at * 1000).toLocaleString());

  function short(value: string): string {
    return `${value.slice(0, 8)}...${value.slice(-4)}`;
  }

  function fullNote(value: string): string {
    try {
      return encodeNote(value);
    } catch {
      return value;
    }
  }

  function openProfile(event: MouseEvent): void {
    event.stopPropagation();
    props.openProfile?.(props.event.pubkey);
  }

  function openThread(event: MouseEvent): void {
    event.stopPropagation();
    props.openThread?.(props.event.id);
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
      <strong>{display.title}</strong>
      <small>{display.subtitle}</small>
    </button>
    <span>{time}</span>
    <button type="button" onclick={openThread}>
      {eventId}
    </button>
  </div>
{/if}
