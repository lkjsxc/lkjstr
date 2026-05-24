<script lang="ts">
  import { onDestroy } from 'svelte';
  import { MoreHorizontal } from '@lucide/svelte';
  import type { NostrEvent } from '$lib/protocol';

  type Props = {
    event: NostrEvent;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (copyTimer) clearTimeout(copyTimer);
  });

  async function copyEventId(event: MouseEvent): Promise<void> {
    event.stopPropagation();
    await navigator.clipboard?.writeText(props.event.id);
    copied = true;
    if (copyTimer) clearTimeout(copyTimer);
    copyTimer = setTimeout(() => (copied = false), 1200);
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
    {#if copied}<small role="status">Copied</small>{/if}
  </div>
</details>
