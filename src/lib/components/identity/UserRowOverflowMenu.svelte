<script lang="ts">
  import { MoreHorizontal } from '@lucide/svelte';
  import { safeNpub } from './user-event-row';
  import {
    copyUserRowNpub,
    type UserRowCopyStatus,
    userRowCopyFailure,
    userRowCopyStatusText,
  } from './user-row-copy-status';

  type Props = {
    pubkey: string;
    copied?: boolean;
    openUserTimeline?: (pubkey: string) => void;
    copyNpub?: (pubkey: string) => void | Promise<void>;
  };

  let props: Props = $props();
  let copyStatus = $state<UserRowCopyStatus | null>(null);

  function stop(event: MouseEvent): void {
    event.stopPropagation();
  }

  async function copy(event: MouseEvent): Promise<void> {
    stop(event);
    if (props.copyNpub) {
      try {
        await props.copyNpub(props.pubkey);
        copyStatus = null;
      } catch (error) {
        copyStatus = userRowCopyFailure(error);
      }
      return;
    }
    copyStatus = await copyUserRowNpub(
      safeNpub(props.pubkey),
      navigator.clipboard,
    );
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
    {#if !props.copied && copyStatus}
      <span role="status">{userRowCopyStatusText(copyStatus)}</span>
    {/if}
  </div>
</details>
