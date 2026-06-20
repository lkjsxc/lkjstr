<script lang="ts">
  import { contentTokens } from '$lib/events/content-tokens';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import CustomEmojiImage from './CustomEmojiImage.svelte';
  import {
    contentTokenEventVisible,
    contentTokenProfileLabel,
    contentTokenRenderKey,
  } from './content-token-plan';
  import ContentTokenLink from './ContentTokenLink.svelte';
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
</script>

<p class="event-content">
  {#each tokens as token, index (contentTokenRenderKey(token, index))}
    {#if token.type === 'text'}
      {token.text}
    {:else if token.type === 'url'}
      <ContentTokenLink text={token.text} url={token.url} />
    {:else if token.type === 'custom-emoji'}
      <CustomEmojiImage emoji={token} />
    {:else if token.type === 'profile'}
      <ProfileMentionChip
        pubkey={token.pubkey}
        text={contentTokenProfileLabel(
          token.pubkey,
          token.rawText,
          props.profiles,
        )}
        rawText={token.rawText}
        profile={props.profiles?.[token.pubkey]}
        openProfile={props.openProfile}
      />
    {:else if token.type === 'event' && contentTokenEventVisible(token.eventId, props.hiddenEventIds)}
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
