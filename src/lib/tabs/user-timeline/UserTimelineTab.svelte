<script lang="ts">
  import { onDestroy } from 'svelte';
  import { loadLkjstrWebWasm } from 'virtual:lkjstr-web-wasm';

  type Props = {
    tabId: string;
    pubkey: string;
    visible?: boolean;
    activeAccountPubkey?: string | null;
    relaySets?: readonly unknown[];
    openProfile: (pubkey: string) => void;
    openThread: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  type UserTimelineIslandHandle = {
    unmount: () => void;
  };

  type UserTimelineModule = {
    mount_user_timeline_tab?: (
      parent: HTMLElement,
      tabId: string,
      pubkey: string,
      openProfile: (pubkey: string) => void,
      openThread: (eventId: string) => void,
      openAuthorContext: (eventId: string, pubkey: string) => void,
    ) => UserTimelineIslandHandle;
  };

  let props: Props = $props();
  let host = $state<HTMLElement>();
  let error = $state('');
  let activeKey = '';
  let generation = 0;
  let handle: UserTimelineIslandHandle | undefined;

  $effect(() => {
    const key = props.visible ? `${props.tabId}:${props.pubkey}` : '';
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
      const module = (await loadLkjstrWebWasm()) as UserTimelineModule;
      const mount = module.mount_user_timeline_tab;
      if (!mount) throw new Error('Rust User Timeline bridge unavailable.');
      const next = mount(
        parent,
        props.tabId,
        props.pubkey,
        props.openProfile,
        props.openThread,
        props.openAuthorContext ?? (() => {}),
      );
      if (generation !== current) {
        next.unmount();
        return;
      }
      handle = next;
      activeKey = key;
    } catch (err) {
      if (generation === current) {
        error = err instanceof Error ? err.message : 'User Timeline failed.';
      }
    }
  }

  function releaseIsland(): void {
    handle?.unmount();
    handle = undefined;
  }
</script>

<section class="hybrid-tab feed-tab user-timeline-tab" aria-label="User Timeline">
  <div class="hybrid-tab__toolbar">
    {#if error}<p role="alert">{error}</p>{/if}
  </div>
  <div bind:this={host}></div>
</section>
