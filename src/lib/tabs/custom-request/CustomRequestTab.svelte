<script lang="ts">
  import { onMount } from 'svelte';
  import { mountCustomRequestIsland } from '$lib/components/workspace/custom-request-island';
  import { rustWasmBridgeErrorMessage } from '$lib/rust-wasm/bridge-unavailable';
  import type { TabSnapshotPayload } from '$lib/workspace/tab-snapshot';

  type CustomRequestIslandHandle = {
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
    let handle: CustomRequestIslandHandle | undefined;
    void mountCustomRequestIsland(islandRoot, {
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
          'Rust Custom Request bridge unavailable.',
        );
      });

    return () => {
      canceled = true;
      handle?.unmount();
    };
  });
</script>

<section class="hybrid-tab feed-tab timeline-tab" aria-label="Custom Request">
  <div bind:this={islandRoot}></div>
  {#if loadError}<p role="alert">{loadError}</p>{/if}
</section>
