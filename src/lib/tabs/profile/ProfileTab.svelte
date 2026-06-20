<script lang="ts">
  import { onMount } from 'svelte';
  import { mountProfileIsland } from '$lib/components/workspace/profile-island';

  type ProfileIslandHandle = {
    unmount: () => void;
  };

  type AccountSummary = {
    pubkey: string;
  };

  type Props = {
    tabId: string;
    pubkey: string;
    activeAccount?: AccountSummary;
    openProfile: (pubkey: string) => void;
    openFollowees: (pubkey: string) => void;
    openUserTimeline: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext: (eventId: string, pubkey: string) => void;
    openProfileEdit: () => void;
  };

  let props: Props = $props();
  let islandRoot = $state<HTMLElement | undefined>();
  let loadError = $state('');

  onMount(() => {
    if (!islandRoot) return;

    let canceled = false;
    let handle: ProfileIslandHandle | undefined;
    void mountProfileIsland(islandRoot, {
      tabId: props.tabId,
      pubkey: props.pubkey,
      activePubkey: props.activeAccount?.pubkey,
      openProfile: props.openProfile,
      openFollowees: props.openFollowees,
      openUserTimeline: props.openUserTimeline,
      openProfileEdit: props.openProfileEdit,
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
            : 'Rust Profile bridge unavailable.';
      });

    return () => {
      canceled = true;
      handle?.unmount();
    };
  });
</script>

<section class="profile-tab feed-tab" aria-label="Profile">
  <div bind:this={islandRoot}></div>
  {#if loadError}<p role="alert">{loadError}</p>{/if}
</section>
