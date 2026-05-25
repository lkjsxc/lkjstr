<script lang="ts">
  import { contentTokens } from '$lib/events/content-tokens';
  import { bestDisplayName } from '$lib/identity/display-name';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import CustomEmojiImage from './CustomEmojiImage.svelte';
  import EventMentionChip from './EventMentionChip.svelte';
  import ProfileMentionChip from './ProfileMentionChip.svelte';

  type Props = {
    event: NostrEvent;
    relays?: readonly string[];
    profiles?: Record<string, ProfileSummary>;
    hiddenEventIds?: ReadonlySet<string>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let tokens = $derived(contentTokens(props.event));

  function stop(event: MouseEvent): void {
    event.stopPropagation();
  }

  function profileLabel(pubkey: string, rawText: string): string {
    const profile = props.profiles?.[pubkey];
    return profile ? `@${bestDisplayName(profile)}` : rawText;
  }
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<p class="event-content">
  {#each tokens as token, index (`${index}:${token.type}`)}
    {#if token.type === 'text'}
      {token.text}
    {:else if token.type === 'url'}
      <a
        class="event-link"
        href={token.url}
        target="_blank"
        rel="noopener noreferrer"
        onclick={stop}>{token.text}</a
      >
    {:else if token.type === 'custom-emoji'}
      <CustomEmojiImage emoji={token} />
    {:else if token.type === 'profile'}
      <ProfileMentionChip
        pubkey={token.pubkey}
        text={profileLabel(token.pubkey, token.rawText)}
        rawText={token.rawText}
        profile={props.profiles?.[token.pubkey]}
        openProfile={props.openProfile}
      />
    {:else if token.type === 'event' && !props.hiddenEventIds?.has(token.eventId)}
      <EventMentionChip
        eventId={token.eventId}
        rawText={token.rawText}
        relays={token.relays}
        fallbackRelays={props.relays}
        profiles={props.profiles}
        openThread={props.openThread}
      />
    {/if}
  {/each}
</p>
