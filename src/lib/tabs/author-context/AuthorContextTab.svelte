<script lang="ts">
  import { onDestroy } from 'svelte';
  import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';
  import type { TabFeedAnchor } from '$lib/workspace/tab-anchor-registry';

  type Props = {
    tabId: string;
    visible?: boolean;
    eventId: string;
    pubkey: string;
    restoreAnchor?: TabFeedAnchor;
    relaySets?: readonly unknown[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext: (eventId: string, pubkey: string) => void;
  };

  type AuthorContextIslandHandle = {
    unmount: () => void;
  };

  type AuthorContextModule = {
    mount_author_context_tab?: (
      parent: HTMLElement,
      tabId: string,
      eventId: string,
      pubkey: string,
      openProfile: (pubkey: string) => void,
      openThread: (eventId: string) => void,
      openAuthorContext: (eventId: string, pubkey: string) => void,
    ) => AuthorContextIslandHandle;
  };

  let props: Props = $props();
  let host = $state<HTMLElement>();
  let error = $state('');
  let activeKey = '';
  let generation = 0;
  let handle: AuthorContextIslandHandle | undefined;

  $effect(() => {
    const key = props.visible
      ? `${props.tabId}:${props.eventId}:${props.pubkey}`
      : '';
    if (!key) {
      releaseIsland();
      activeKey = '';
      return;
    }
    if (key === activeKey) return;
    void mountIsland(key);
  });

  onDestroy(() => {
    generation += 1;
    releaseIsland();
  });

  async function mountIsland(key: string): Promise<void> {
    const parent = host;
    if (!parent) return;
    generation += 1;
    const current = generation;
    releaseIsland();
    error = '';
    try {
      const module = (await loadLkjstrWebWasm()) as AuthorContextModule;
      const mount = module.mount_author_context_tab;
      if (!mount) throw new Error('Rust Author Context bridge unavailable.');
      const next = mount(
        parent,
        props.tabId,
        props.eventId,
        props.pubkey,
        props.openProfile,
        props.openThread,
        props.openAuthorContext,
      );
      if (generation !== current) {
        next.unmount();
        return;
      }
      handle = next;
      activeKey = key;
    } catch (err) {
      if (generation === current) {
        error = err instanceof Error ? err.message : 'Author Context failed.';
      }
    }
  }

  function releaseIsland(): void {
    handle?.unmount();
    handle = undefined;
  }
</script>

<section class="hybrid-tab feed-tab timeline-tab" aria-label="Author Context">
  <div class="hybrid-tab__toolbar">
    {#if error}<p role="alert">{error}</p>{/if}
  </div>
  <div bind:this={host}></div>
</section>
