<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MoreHorizontal } from '@lucide/svelte';
  import type { NostrEvent } from '$lib/protocol';
  import {
    copyEventIdToClipboard,
    copyEventStatusLabel,
    type EventMoreMenuCopyStatus,
  } from './event-more-menu';

  type Props = {
    event: NostrEvent;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let copyStatus = $state<EventMoreMenuCopyStatus | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (copyTimer) clearTimeout(copyTimer);
  });

  async function copyEventId(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    copyStatus = await copyEventIdToClipboard(
      props.event.id,
      navigator.clipboard,
    );
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copyStatus = null), 1200);
  }

  function openNearby(event: MouseEvent): void {
    event.stopPropagation();
    props.openAuthorContext?.(props.event.id, props.event.pubkey);
  }
</script>

<details class="event-more event-action-zone">
  <summary aria-label="Event menu" onclick={(event) => event.stopPropagation()}>
    <MoreHorizontal size={16} />
  </summary>
  <div class="event-more__items">
    <button type="button" onclick={openNearby}
      >Nearby posts by this author</button
    >
    <button type="button" onclick={copyEventId}>Copy event ID</button>
    {#if copyStatus}<small role="status"
        >{copyEventStatusLabel(copyStatus)}</small
      >{/if}
  </div>
</details>
