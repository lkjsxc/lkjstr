<script lang="ts">
  import { onDestroy } from 'svelte';
  import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';
  import {
    copyUserRowNpub,
    userRowCopyStatusText,
  } from '$lib/components/identity/user-row-copy-status';
  import { safeNpub } from '$lib/components/identity/user-event-row';

  type Props = {
    tabId: string;
    pubkey: string;
    visible?: boolean;
    relaySets?: readonly unknown[];
    openProfile: (pubkey: string) => void;
    openUserTimeline: (pubkey: string) => void;
  };

  type FolloweesIslandHandle = {
    unmount: () => void;
  };

  type FolloweesModule = {
    mount_followees_tab?: (
      parent: HTMLElement,
      tabId: string,
      pubkey: string,
      openProfile: (pubkey: string) => void,
      openUserTimeline: (pubkey: string) => void,
      copyNpub: (pubkey: string) => void | Promise<void>,
    ) => FolloweesIslandHandle;
  };

  let props: Props = $props();
  let host = $state<HTMLElement>();
  let error = $state('');
  let copyStatus = $state('');
  let activeKey = '';
  let generation = 0;
  let handle: FolloweesIslandHandle | undefined;

  $effect(() => {
    const key = props.visible ? `${props.tabId}:${props.pubkey}` : '';
    if (!key) {
      cancelIsland();
      return;
    }
    if (key === activeKey) return;
    void mountIsland(key);
  });

  onDestroy(() => {
    cancelIsland();
  });

  async function mountIsland(key: string): Promise<void> {
    const parent = host;
    if (!parent) return;
    generation += 1;
    const current = generation;
    releaseIsland();
    error = '';
    try {
      const module = (await loadLkjstrWebWasm()) as FolloweesModule;
      const mount = module.mount_followees_tab;
      if (!mount) throw new Error('Rust Followees bridge unavailable.');
      const next = mount(
        parent,
        props.tabId,
        props.pubkey,
        props.openProfile,
        props.openUserTimeline,
        copyNpub,
      );
      if (generation !== current) {
        next.unmount();
        return;
      }
      handle = next;
      activeKey = key;
    } catch (err) {
      if (generation === current) {
        error = err instanceof Error ? err.message : 'Followees failed.';
      }
    }
  }

  async function copyNpub(pubkey: string): Promise<void> {
    const status = await copyUserRowNpub(safeNpub(pubkey), navigator.clipboard);
    copyStatus = userRowCopyStatusText(status);
  }

  function releaseIsland(): void {
    handle?.unmount();
    handle = undefined;
  }

  function cancelIsland(): void {
    generation += 1;
    releaseIsland();
    activeKey = '';
  }
</script>

<section class="hybrid-tab feed-tab followees-tab" aria-label="Following">
  <div class="hybrid-tab__toolbar">
    {#if error}<p role="alert">{error}</p>{/if}
    {#if copyStatus}<p role="status">{copyStatus}</p>{/if}
  </div>
  <div bind:this={host}></div>
</section>
