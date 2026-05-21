<script lang="ts">
  import { contentTokens } from '$lib/events/content-tokens';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NostrEvent } from '$lib/protocol';
  import EmojifiedText from './EmojifiedText.svelte';

  type Props = {
    event: NostrEvent;
    profiles?: Record<string, ProfileSummary>;
    hiddenEventIds?: ReadonlySet<string>;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let tokens = $derived(
    contentTokens(
      props.event,
      props.profiles ?? {},
      props.hiddenEventIds ?? new Set(),
    ),
  );

  function stop(event: MouseEvent): void {
    event.stopPropagation();
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
      <img class="custom-emoji" src={token.url} alt={token.text} />
    {:else if token.type === 'profile'}
      <button
        type="button"
        class="content-token"
        title={token.rawText}
        onclick={(event) => {
          event.stopPropagation();
          props.openProfile?.(token.pubkey);
        }}
      >
        <EmojifiedText
          text={token.text}
          emojis={props.profiles?.[token.pubkey]?.customEmojis ?? []}
        />
      </button>
    {:else if token.type === 'event'}
      <button
        type="button"
        class="content-token"
        title={token.rawText}
        onclick={(event) => {
          event.stopPropagation();
          props.openThread?.(token.eventId);
        }}
      >
        {token.text}
      </button>
    {/if}
  {/each}
</p>
