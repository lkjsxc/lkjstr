<script lang="ts">
  import { onMount } from 'svelte';
  import { mountThreadIsland } from '$lib/components/workspace/thread-island';

  type ThreadIslandHandle = {
    unmount: () => void;
  };

  type Props = {
    tabId: string;
    eventId?: string;
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let islandRoot = $state<HTMLElement | undefined>();
  let loadError = $state('');

  onMount(() => {
    const eventId = props.eventId ?? '';
    if (!eventId || !islandRoot) return;

    let canceled = false;
    let handle: ThreadIslandHandle | undefined;
    void mountThreadIsland(islandRoot, {
      tabId: props.tabId,
      eventId,
      openProfile: props.openProfile,
      openThread: props.openThread,
      openAuthorContext: props.openAuthorContext,
    })
      .then((mounted) => {
        if (canceled) {
          mounted.unmount();
          return;
        }
        handle = mounted;
      })
      .catch((error: unknown) => {
        if (canceled) return;
        loadError =
          error instanceof Error
            ? error.message
            : 'Rust Thread bridge unavailable.';
      });

    return () => {
      canceled = true;
      handle?.unmount();
    };
  });
</script>

<section class="feed-tab" aria-label="Thread">
  {#if props.eventId}
    <div bind:this={islandRoot}></div>
    {#if loadError}<p role="alert">{loadError}</p>{/if}
  {:else}
    <p>Open threads from a timeline event.</p>
  {/if}
</section>
