<script lang="ts">
  import { MoreHorizontal } from '@lucide/svelte';
  import { safeNpub } from './user-event-row';

  type Props = {
    pubkey: string;
    copied?: boolean;
    openUserTimeline?: (pubkey: string) => void;
    copyNpub?: (pubkey: string) => void | Promise<void>;
  };

  let props: Props = $props();

  function stop(event: MouseEvent): void {
    event.stopPropagation();
  }

  async function copy(event: MouseEvent): Promise<void> {
    stop(event);
    if (props.copyNpub) {
      await props.copyNpub(props.pubkey);
      return;
    }
    await navigator.clipboard?.writeText(safeNpub(props.pubkey));
  }
</script>

<details class="user-row-overflow-menu event-action-zone">
  <summary aria-label="User actions" title="User actions" onclick={stop}>
    <MoreHorizontal size={16} aria-hidden="true" />
  </summary>
  <div class="user-row-overflow-menu__items">
    {#if props.openUserTimeline}
      <button
        type="button"
        onclick={(event) => {
          stop(event);
          props.openUserTimeline?.(props.pubkey);
        }}
      >
        Open user timeline
      </button>
    {/if}
    <button type="button" onclick={copy}>Copy npub</button>
    {#if props.copied}<span role="status">Copied</span>{/if}
  </div>
</details>
