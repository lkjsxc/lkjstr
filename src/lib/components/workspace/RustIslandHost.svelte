<script lang="ts">
  import { onDestroy } from 'svelte';
  import { rustWasmBridgeErrorMessage } from '$lib/rust-wasm/bridge-unavailable';

  export type RustIslandHandle = {
    unmount: () => void;
  };

  type Props = {
    label: string;
    className?: string;
    mountKey: string;
    fallbackError: string;
    status?: string;
    mount: (
      parent: HTMLElement,
    ) => RustIslandHandle | Promise<RustIslandHandle>;
  };

  let props: Props = $props();
  let host = $state<HTMLElement>();
  let error = $state('');
  let activeKey = '';
  let generation = 0;
  let handle: RustIslandHandle | undefined;

  $effect(() => {
    const key = props.mountKey;
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
      const next = await props.mount(parent);
      if (generation !== current) {
        next.unmount();
        return;
      }
      handle = next;
      activeKey = key;
    } catch (err) {
      if (generation === current) {
        error = rustWasmBridgeErrorMessage(err, props.fallbackError);
      }
    }
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

<section
  class={`hybrid-tab feed-tab ${props.className ?? ''}`}
  aria-label={props.label}
>
  <div class="hybrid-tab__toolbar">
    {#if error}<p role="alert">{error}</p>{/if}
    {#if props.status}<p role="status">{props.status}</p>{/if}
  </div>
  <div bind:this={host}></div>
</section>
