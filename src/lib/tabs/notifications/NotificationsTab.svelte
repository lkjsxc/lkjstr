<script lang="ts">
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { NotificationRecord } from '$lib/notifications/notification';

  type Props = {
    notifications: NotificationRecord[];
  };

  let props: Props = $props();
</script>

<section class="data-tab">
  <h2>Notifications</h2>
  {#each props.notifications as notification (notification.id)}
    <article class="row">
      <IdentityChip pubkey={notification.actorPubkey} compact />
      <span>{notification.kind}</span>
      <small>{notification.sourceEventId.slice(0, 12)}</small>
    </article>
  {:else}
    <p>No notification records are indexed for the active account.</p>
  {/each}
</section>
