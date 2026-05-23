<script lang="ts">
  import EventRow from '$lib/components/events/EventRow.svelte';
  import IdentityChip from '$lib/components/identity/IdentityChip.svelte';
  import type { FeedEvent } from '$lib/events/types';
  import type { ProfileSummary } from '$lib/identity/identity';
  import type { NotificationRecord } from '$lib/notifications/notification';
  import { notificationActionText } from '$lib/notifications/notification-presentation';
  import type { RelaySet } from '$lib/relays/relay-store';

  type Props = {
    record: NotificationRecord;
    item?: FeedEvent;
    targetItem?: FeedEvent;
    profile?: ProfileSummary;
    profiles?: Record<string, ProfileSummary>;
    relaySets?: readonly RelaySet[];
    openProfile?: (pubkey: string) => void;
    openThread?: (eventId: string) => void;
    openAuthorContext?: (eventId: string, pubkey: string) => void;
  };

  let props: Props = $props();
  let label = $derived(notificationActionText(props.record, props.item?.event));
  let time = $derived(new Date(props.record.createdAt * 1000).toLocaleString());
  let preview = $derived(props.targetItem ?? props.item);
</script>

<article class:unread={!props.record.readAt} class="notification-row">
  {#if !props.record.readAt}<span class="sr-only">Unread</span>{/if}
  <div class="notification-row__body">
    <div class="notification-row__meta">
      <button
        type="button"
        class="identity-button notification-row__actor"
        onclick={() => props.openProfile?.(props.record.actorPubkey)}
      >
        <IdentityChip
          pubkey={props.record.actorPubkey}
          profile={props.profile}
        />
      </button>
      <strong>{label}</strong>
      <time datetime={new Date(props.record.createdAt * 1000).toISOString()}>
        {time}
      </time>
    </div>
    {#if preview}
      <div class="notification-row__preview">
        <EventRow
          item={preview}
          profile={props.profiles?.[preview.event.pubkey]}
          profiles={props.profiles}
          relaySets={props.relaySets}
          compact
          showActions={false}
          showMore={false}
          openProfile={props.openProfile}
          openThread={props.openThread}
          openAuthorContext={props.openAuthorContext}
        />
      </div>
    {:else}
      <p class="event-content">Event content unavailable.</p>
    {/if}
  </div>
</article>
