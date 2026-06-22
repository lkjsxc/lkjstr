<script lang="ts">
  import { onMount } from 'svelte';
  import { mountSearchIsland } from '$lib/components/workspace/search-island';
  import { rustWasmBridgeErrorMessage } from '$lib/rust-wasm/bridge-unavailable';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';

  type SearchIslandHandle = {
    unmount: () => void;
  };

  type Props = {
    tabId: string;
    restoreSnapshot?: TabSnapshotPayload;
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let islandRoot: HTMLElement;
  let loadError = $state('');

  onMount(() => {
    let canceled = false;
    let handle: SearchIslandHandle | undefined;
    void mountSearchIsland(islandRoot, {
      tabId: props.tabId,
      restoreSnapshot: props.restoreSnapshot,
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
        loadError = rustWasmBridgeErrorMessage(
          error,
          'Rust Search bridge unavailable.',
        );
      });

    return () => {
      canceled = true;
      handle?.unmount();
    };
  });
</script>

<section class="timeline-tab feed-tab" aria-label="Search">
  <div bind:this={islandRoot}></div>
  {#if loadError}<p role="alert">{loadError}</p>{/if}
</section>
