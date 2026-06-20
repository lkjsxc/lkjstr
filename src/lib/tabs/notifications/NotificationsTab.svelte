<script lang="ts">
  import { onMount } from 'svelte';
  import { mountNotificationsIsland } from '$lib/components/workspace/notifications-island';

  type NotificationsIslandHandle = {
    unmount: () => void;
  };

  type Props = {
    tabId: string;
    accountPubkey?: string;
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let islandRoot: HTMLElement;
  let loadError = $state('');

  onMount(() => {
    let canceled = false;
    let handle: NotificationsIslandHandle | undefined;
    void mountNotificationsIsland(islandRoot, {
      tabId: props.tabId,
      activePubkey: props.accountPubkey,
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
            : 'Rust Notifications bridge unavailable.';
      });

    return () => {
      canceled = true;
      handle?.unmount();
    };
  });
</script>

<section class="feed-tab" aria-label="Notifications">
  <div bind:this={islandRoot}></div>
  {#if loadError}<p role="alert">{loadError}</p>{/if}
</section>
