<script lang="ts">
  import { contentTokens } from '$lib/events/content-tokens';
  import type { NostrEvent } from '$lib/protocol';

  type Props = {
    event: NostrEvent;
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
  };

  let props: Props = $props();
  let tokens = $derived(contentTokens(props.event));

  function stop(event: MouseEvent): void {
    event.stopPropagation();
  }
</script>

<p class="event-content">
  {#each tokens as token, index (`${index}:${token.type}`)}
    {#if token.type === 'text'}
      {token.text}
    {:else if token.type === 'url'}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a class="event-link" href={token.url} onclick={stop}>{token.text}</a>
    {:else if token.type === 'profile'}
      <button
        type="button"
        class="content-token"
        onclick={(event) => {
          event.stopPropagation();
          props.openProfile?.(token.pubkey);
        }}
      >
        {token.text}
      </button>
    {:else if token.type === 'event'}
      <button
        type="button"
        class="content-token"
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
